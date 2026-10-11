import type { PrismaClient } from "@prisma/client";
import { computeMargin, priorityFor, rngFromSeed } from "@shock/shared";
import { loadBooks } from "../services/books";
import { writeExceptions } from "../services/exceptionWriter";
import { num } from "../db";

const SWEEP_LOCK_ID = 7_310_442; // arbitrary app-wide advisory lock key

/** Random-walk the demo price feed by up to +/- maxMove and record ticks. */
export async function tickPriceFeed(prisma: PrismaClient, seed: string, maxMove = 0.015) {
  const rand = rngFromSeed(seed);
  const instruments = await prisma.instrument.findMany({ orderBy: { symbol: "asc" } });
  await prisma.$transaction(
    instruments.flatMap((i) => {
      const next = Math.max(0.01, Math.round(num(i.price) * (1 + (rand() * 2 - 1) * maxMove) * 100) / 100);
      return [
        prisma.instrument.update({ where: { symbol: i.symbol }, data: { price: next } }),
        prisma.priceTick.create({ data: { symbol: i.symbol, price: next } }),
      ];
    }),
  );
}

export interface SweepResult {
  checked: number;
  breaches: number;
  created: number;
  skippedLocked: boolean;
}

/**
 * Flags accounts below maintenance on current prices. One exception per account
 * per day (dedupeKey "sweep:<date>"), so the job can run every few minutes safely.
 * A Postgres advisory lock stops two API instances sweeping at once.
 */
export async function runMarginSweep(
  prisma: PrismaClient,
  opts: { tick?: boolean; now?: Date } = {},
): Promise<SweepResult> {
  const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${SWEEP_LOCK_ID}) AS locked`;
  if (!locked) return { checked: 0, breaches: 0, created: 0, skippedLocked: true };

  try {
    const now = opts.now ?? new Date();
    if (opts.tick) await tickPriceFeed(prisma, now.toISOString());

    const books = await loadBooks(prisma);
    const breaches = books
      .map((b) => ({ accountId: b.account.id, margin: computeMargin(b.account, b.positions) }))
      .filter((r) => r.margin.breached)
      .map((r) => ({ ...r, priority: priorityFor(r.margin) }));

    const { created } = await writeExceptions(prisma, breaches, {
      dedupeKey: `sweep:${now.toISOString().slice(0, 10)}`,
      source: "SWEEP",
      actorId: "system",
    });
    return { checked: books.length, breaches: breaches.length, created, skippedLocked: false };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${SWEEP_LOCK_ID})`;
  }
}

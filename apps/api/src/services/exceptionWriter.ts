import { Prisma, type PrismaClient } from "@prisma/client";
import type { ExceptionPriority, MarginResult } from "@shock/shared";

export interface BreachInput {
  accountId: string;
  margin: MarginResult;
  priority: ExceptionPriority;
}

/**
 * Idempotent: (accountId, dedupeKey) is unique, so re-running the same sweep or
 * the same scenario run never creates duplicates. Safe under concurrent runs
 * because a lost race surfaces as P2002 and is skipped.
 */
export async function writeExceptions(
  prisma: PrismaClient,
  breaches: BreachInput[],
  opts: { dedupeKey: string; source: "SWEEP" | "SCENARIO"; actorId: string; scenarioRunId?: string },
): Promise<{ created: number; skipped: number }> {
  if (breaches.length === 0) return { created: 0, skipped: 0 };

  const existing = await prisma.exception.findMany({
    where: { dedupeKey: opts.dedupeKey, accountId: { in: breaches.map((b) => b.accountId) } },
    select: { accountId: true },
  });
  const seen = new Set(existing.map((e) => e.accountId));

  let created = 0;
  for (const b of breaches) {
    if (seen.has(b.accountId)) continue;
    try {
      await prisma.exception.create({
        data: {
          accountId: b.accountId,
          source: opts.source,
          dedupeKey: opts.dedupeKey,
          priority: b.priority,
          equity: b.margin.equity,
          maintenanceReq: b.margin.maintenanceRequirement,
          deficit: b.margin.deficit,
          scenarioRunId: opts.scenarioRunId,
          audit: {
            create: {
              action: "CREATED",
              actorId: opts.actorId,
              payload: { source: opts.source, dedupeKey: opts.dedupeKey, deficit: b.margin.deficit },
            },
          },
        },
      });
      created++;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  return { created, skipped: breaches.length - created };
}

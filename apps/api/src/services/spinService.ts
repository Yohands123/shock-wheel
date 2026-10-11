import type { PrismaClient } from "@prisma/client";
import { SCENARIOS, priorityFor, randomSeed, spinOutcome, stressAccount } from "@shock/shared";
import { loadBooks } from "./books";
import { writeExceptions } from "./exceptionWriter";
import { explainScenario } from "./explainer";

/**
 * Spin the wheel. The outcome is decided server-side from the seed, so the UI
 * animates to a result it cannot influence, and any run can be replayed by seed.
 */
export async function spinWheel(prisma: PrismaClient, actorId: string, seed = randomSeed()) {
  const outcome = spinOutcome(seed, SCENARIOS.length);
  const scenario = SCENARIOS[outcome.sliceIndex];

  const run = await prisma.scenarioRun.create({
    data: {
      scenarioId: scenario.id,
      severityLabel: outcome.severityLabel,
      severity: outcome.severity,
      seed,
      sliceIndex: outcome.sliceIndex,
      createdById: actorId,
    },
  });
  await prisma.auditLog.create({
    data: { action: "SPIN", actorId, payload: { runId: run.id, seed, scenarioId: scenario.id, severity: outcome.severityLabel } },
  });

  const books = await loadBooks(prisma);
  const results = books.map((b) => ({ book: b, ...stressAccount(b.account, b.positions, scenario, outcome.severity) }));
  const breached = results.filter((r) => r.after.breached);

  await writeExceptions(
    prisma,
    breached.map((r) => ({ accountId: r.book.account.id, margin: r.after, priority: priorityFor(r.after) })),
    { dedupeKey: `run:${run.id}`, source: "SCENARIO", actorId, scenarioRunId: run.id },
  );

  const explanation = await explainScenario({
    scenario,
    severityLabel: outcome.severityLabel,
    severity: outcome.severity,
    accountCount: books.length,
    breaches: breached.map((r) => {
      const worst = [...r.shocked].sort((a, b) => a.pnl - b.pnl)[0];
      return {
        accountId: r.book.account.id,
        name: r.book.account.name,
        deficit: r.after.deficit,
        equityBefore: r.before.equity,
        equityAfter: r.after.equity,
        worstPosition: worst && worst.pnl < 0 ? { symbol: worst.symbol, sector: worst.sector, pnl: worst.pnl } : null,
      };
    }),
  });

  return prisma.scenarioRun.update({ where: { id: run.id }, data: { explanation } });
}

import type { Prisma, ScenarioRun as RunRow, Exception as ExRow } from "@prisma/client";
import { GraphQLError } from "graphql";
import { SECTORS, scenarioById, SCENARIOS, computeMargin, stressAccount, type Scenario } from "@shock/shared";
import type { Context } from "./context";
import { num } from "./db";
import { loadBooks } from "./services/books";
import { spinWheel } from "./services/spinService";
import { assignException, escalateException, resolveException } from "./services/workflow";
import { runMarginSweep } from "./jobs/marginSweep";

const iso = (d: Date) => d.toISOString();

async function requireActor(ctx: Context) {
  const user = await ctx.prisma.user.findUnique({ where: { id: ctx.actorId } });
  if (!user) throw new GraphQLError("Unknown user", { extensions: { code: "UNAUTHENTICATED" } });
  return user;
}

export const resolvers = {
  Query: {
    me: (_: unknown, __: unknown, ctx: Context) => ctx.prisma.user.findUnique({ where: { id: ctx.actorId } }),
    users: (_: unknown, __: unknown, ctx: Context) =>
      ctx.prisma.user.findMany({ where: { role: { not: "system" } }, orderBy: { name: "asc" } }),
    scenarios: () => SCENARIOS,

    exceptions: (
      _: unknown,
      { filter = {}, limit }: { filter?: Record<string, any>; limit: number },
      ctx: Context,
    ) => {
      const where: Prisma.ExceptionWhereInput = {
        status: filter.status?.length ? { in: filter.status } : undefined,
        priority: filter.priority?.length ? { in: filter.priority } : undefined,
        source: filter.source ?? undefined,
        scenarioRunId: filter.scenarioRunId ?? undefined,
        assigneeId: filter.assigneeId ?? undefined,
        account: filter.search
          ? {
              OR: [
                { id: { contains: filter.search, mode: "insensitive" } },
                { name: { contains: filter.search, mode: "insensitive" } },
                { owner: { contains: filter.search, mode: "insensitive" } },
              ],
            }
          : undefined,
      };
      return ctx.prisma.exception.findMany({
        where,
        take: Math.min(limit, 500),
        orderBy: [{ deficit: "desc" }, { createdAt: "desc" }],
      });
    },
    exception: (_: unknown, { id }: { id: string }, ctx: Context) => ctx.prisma.exception.findUnique({ where: { id } }),
    account: (_: unknown, { id }: { id: string }, ctx: Context) => ctx.prisma.account.findUnique({ where: { id } }),
    scenarioRuns: (_: unknown, { limit }: { limit: number }, ctx: Context) =>
      ctx.prisma.scenarioRun.findMany({ take: Math.min(limit, 50), orderBy: { createdAt: "desc" } }),
    scenarioRun: (_: unknown, { id }: { id: string }, ctx: Context) => ctx.prisma.scenarioRun.findUnique({ where: { id } }),

    queueStats: async (_: unknown, __: unknown, ctx: Context) => {
      const [groups, open] = await Promise.all([
        ctx.prisma.exception.groupBy({ by: ["status"], _count: { _all: true } }),
        ctx.prisma.exception.aggregate({ where: { status: { not: "RESOLVED" } }, _sum: { deficit: true } }),
      ]);
      const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
      return {
        open: count("OPEN"),
        assigned: count("ASSIGNED"),
        escalated: count("ESCALATED"),
        resolved: count("RESOLVED"),
        openDeficit: num(open._sum.deficit ?? 0),
      };
    },
  },

  Mutation: {
    spinWheel: async (_: unknown, { seed }: { seed?: string }, ctx: Context) => {
      await requireActor(ctx);
      return spinWheel(ctx.prisma, ctx.actorId, seed ?? undefined);
    },
    assignException: async (_: unknown, a: { id: string; userId: string }, ctx: Context) => {
      await requireActor(ctx);
      return assignException(ctx.prisma, ctx.actorId, a.id, a.userId);
    },
    resolveException: async (_: unknown, a: { id: string; note: string }, ctx: Context) => {
      await requireActor(ctx);
      return resolveException(ctx.prisma, ctx.actorId, a.id, a.note);
    },
    escalateException: async (_: unknown, a: { id: string; reason: string }, ctx: Context) => {
      await requireActor(ctx);
      return escalateException(ctx.prisma, ctx.actorId, a.id, a.reason);
    },
    runMarginSweep: async (_: unknown, { tick }: { tick: boolean }, ctx: Context) => {
      await requireActor(ctx);
      return runMarginSweep(ctx.prisma, { tick });
    },
  },

  Scenario: {
    shocks: (s: Scenario) =>
      SECTORS.flatMap((sector) => (s.sectorShocks[sector] === undefined ? [] : [{ sector, pct: s.sectorShocks[sector]! }])),
  },

  ScenarioRun: {
    scenario: (r: RunRow) => scenarioById(r.scenarioId),
    createdAt: (r: RunRow) => iso(r.createdAt),
    createdBy: (r: RunRow, _: unknown, ctx: Context) => ctx.prisma.user.findUnique({ where: { id: r.createdById } }),
    explanation: (r: RunRow) => r.explanation,
    breachCount: (r: RunRow, _: unknown, ctx: Context) => ctx.prisma.exception.count({ where: { scenarioRunId: r.id } }),
    totalDeficit: async (r: RunRow, _: unknown, ctx: Context) => {
      const agg = await ctx.prisma.exception.aggregate({ where: { scenarioRunId: r.id }, _sum: { deficit: true } });
      return num(agg._sum.deficit ?? 0);
    },
  },

  Account: {
    cash: (a: { cash: unknown }) => num(a.cash),
    exceptions: (a: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.exception.findMany({ where: { accountId: a.id }, orderBy: { createdAt: "desc" } }),
    margin: async (a: { id: string }, { scenarioRunId }: { scenarioRunId?: string }, ctx: Context) => {
      const [book] = await loadBooks(ctx.prisma, [a.id]);
      const before = computeMargin(book.account, book.positions);
      const run = scenarioRunId ? await ctx.prisma.scenarioRun.findUnique({ where: { id: scenarioRunId } }) : null;
      if (!run) {
        return {
          before,
          after: null,
          positions: book.positions.map((p) => ({ ...p, marketValue: p.qty * p.price })),
        };
      }
      const stressed = stressAccount(book.account, book.positions, scenarioById(run.scenarioId), run.severity);
      return {
        before: stressed.before,
        after: stressed.after,
        positions: stressed.shocked.map((p, i) => ({ ...p, name: book.positions[i].name })),
      };
    },
  },

  Exception: {
    account: (e: ExRow, _: unknown, ctx: Context) => ctx.prisma.account.findUniqueOrThrow({ where: { id: e.accountId } }),
    equity: (e: ExRow) => num(e.equity),
    maintenanceRequirement: (e: ExRow) => num(e.maintenanceReq),
    deficit: (e: ExRow) => num(e.deficit),
    scenarioRun: (e: ExRow, _: unknown, ctx: Context) =>
      e.scenarioRunId ? ctx.prisma.scenarioRun.findUnique({ where: { id: e.scenarioRunId } }) : null,
    assignee: (e: ExRow, _: unknown, ctx: Context) =>
      e.assigneeId ? ctx.prisma.user.findUnique({ where: { id: e.assigneeId } }) : null,
    createdAt: (e: ExRow) => iso(e.createdAt),
    updatedAt: (e: ExRow) => iso(e.updatedAt),
    audit: async (e: ExRow, _: unknown, ctx: Context) => {
      const rows = await ctx.prisma.auditLog.findMany({
        where: { exceptionId: e.id },
        include: { actor: true },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({ ...r, payload: JSON.stringify(r.payload), createdAt: iso(r.createdAt) }));
    },
  },
};

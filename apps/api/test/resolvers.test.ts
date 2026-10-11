import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { gql, prisma, resetDb } from "./helpers";
import { runMarginSweep } from "../src/jobs/marginSweep";

const SPIN = /* GraphQL */ `
  mutation Spin($seed: String) {
    spinWheel(seed: $seed) {
      id seed sliceIndex severityLabel breachCount totalDeficit
      scenario { id name }
      explanation { headline source accountsAtRisk { accountId } }
    }
  }`;

const QUEUE = /* GraphQL */ `
  query Queue($filter: ExceptionFilter) {
    exceptions(filter: $filter) { id status priority deficit account { id } assignee { id } }
  }`;

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("spinWheel", () => {
  it("is reproducible: the same seed lands on the same scenario and breaches", async () => {
    const a = await gql(SPIN, { seed: "replay-me" });
    const b = await gql(SPIN, { seed: "replay-me" });
    expect(a.errors).toBeUndefined();
    expect(b.data.spinWheel.scenario.id).toBe(a.data.spinWheel.scenario.id);
    expect(b.data.spinWheel.severityLabel).toBe(a.data.spinWheel.severityLabel);
    expect(b.data.spinWheel.breachCount).toBe(a.data.spinWheel.breachCount);
    expect(b.data.spinWheel.id).not.toBe(a.data.spinWheel.id); // separate audited runs
  });

  it("writes one exception per breached account and an explanation", async () => {
    const { data } = await gql(SPIN, { seed: "s-1" });
    const run = data.spinWheel;
    const q = await gql(QUEUE, { filter: { scenarioRunId: run.id } });
    expect(q.data.exceptions).toHaveLength(run.breachCount);
    expect(new Set(q.data.exceptions.map((e: any) => e.account.id)).size).toBe(run.breachCount);
    expect(run.explanation.source).toBe("template"); // no API key in tests
    expect(run.explanation.headline).toContain(run.scenario.name);
  });

  it("records a SPIN audit entry with the seed", async () => {
    await gql(SPIN, { seed: "audit-seed" });
    const spins = await prisma.auditLog.findMany({ where: { action: "SPIN" } });
    expect(spins).toHaveLength(1);
    expect((spins[0].payload as any).seed).toBe("audit-seed");
  });
});

describe("margin sweep job", () => {
  it("is idempotent within a day", async () => {
    const now = new Date("2026-10-11T14:00:00Z");
    const first = await runMarginSweep(prisma, { now });
    const second = await runMarginSweep(prisma, { now });
    expect(first.created).toBeGreaterThan(0); // ACC-1015 is seeded underwater
    expect(second.created).toBe(0);
    expect(second.breaches).toBe(first.breaches);
    expect(await prisma.exception.count({ where: { source: "SWEEP" } })).toBe(first.created);
  });

  it("never leaves the advisory lock held, even after overlapping sweeps", async () => {
    const now = new Date("2026-10-11T14:00:00Z");
    for (let i = 0; i < 5; i++) {
      await Promise.all([runMarginSweep(prisma, { now }), runMarginSweep(prisma, { now }), runMarginSweep(prisma, { now })]);
    }
    // Every lock was released: a later sweep is never locked out
    expect((await runMarginSweep(prisma, { now })).skippedLocked).toBe(false);
    const held = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_locks WHERE locktype = 'advisory'`;
    expect(Number(held[0].n)).toBe(0);
  });

  it("creates a fresh exception on a new day", async () => {
    await runMarginSweep(prisma, { now: new Date("2026-10-11T14:00:00Z") });
    const nextDay = await runMarginSweep(prisma, { now: new Date("2026-10-12T14:00:00Z") });
    expect(nextDay.created).toBeGreaterThan(0);
  });
});

describe("exception workflow", () => {
  async function firstException() {
    await runMarginSweep(prisma, { now: new Date() });
    const q = await gql(QUEUE);
    return q.data.exceptions[0].id as string;
  }

  it("assign -> escalate -> resolve, each writing an audit row", async () => {
    const id = await firstException();

    const assigned = await gql(`mutation($id: ID!) { assignException(id: $id, userId: "u-theo") { status assignee { id } } }`, { id });
    expect(assigned.data.assignException).toEqual({ status: "ASSIGNED", assignee: { id: "u-theo" } });

    const escalated = await gql(
      `mutation($id: ID!) { escalateException(id: $id, reason: "Client unreachable before cutoff") { status assignee { id } } }`,
      { id }, "u-theo",
    );
    expect(escalated.data.escalateException).toEqual({ status: "ESCALATED", assignee: { id: "u-priya" } });

    const resolved = await gql(
      `mutation($id: ID!) { resolveException(id: $id, note: "Wire received, call met") { status resolutionNote } }`,
      { id }, "u-priya",
    );
    expect(resolved.data.resolveException.status).toBe("RESOLVED");

    const audit = await gql(`query($id: ID!) { exception(id: $id) { audit { action actor { id } } } }`, { id });
    expect(audit.data.exception.audit.map((a: any) => a.action)).toEqual(["CREATED", "ASSIGNED", "ESCALATED", "RESOLVED"]);
    expect(audit.data.exception.audit.at(-1).actor.id).toBe("u-priya");
  });

  it("rejects acting on a resolved exception", async () => {
    const id = await firstException();
    await gql(`mutation($id: ID!) { resolveException(id: $id, note: "Deposit posted") { id } }`, { id });
    const again = await gql(`mutation($id: ID!) { resolveException(id: $id, note: "Deposit posted") { id } }`, { id });
    expect(again.errors?.[0].extensions?.code).toBe("CONFLICT");
  });

  it("requires a meaningful escalation reason", async () => {
    const id = await firstException();
    const res = await gql(`mutation($id: ID!) { escalateException(id: $id, reason: "hm") { id } }`, { id });
    expect(res.errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
    expect(await prisma.auditLog.count({ where: { action: "ESCALATED" } })).toBe(0);
  });

  it("rejects unknown actors", async () => {
    const id = await firstException();
    const res = await gql(`mutation($id: ID!) { resolveException(id: $id, note: "Looks fine") { id } }`, { id }, "intruder");
    expect(res.errors?.[0].extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("only one of two concurrent resolves wins", async () => {
    const id = await firstException();
    const m = `mutation($id: ID!) { resolveException(id: $id, note: "Call met by wire") { id } }`;
    const results = await Promise.all([gql(m, { id }), gql(m, { id }, "u-theo")]);
    expect(results.filter((r) => !r.errors)).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { exceptionId: id, action: "RESOLVED" } })).toBe(1);
  });
});

describe("queries", () => {
  it("filters the queue by priority and search", async () => {
    await gql(SPIN, { seed: "filter-test" });
    const all = await gql(QUEUE);
    const crit = await gql(QUEUE, { filter: { priority: ["CRITICAL"] } });
    expect(crit.data.exceptions.every((e: any) => e.priority === "CRITICAL")).toBe(true);
    expect(crit.data.exceptions.length).toBeLessThanOrEqual(all.data.exceptions.length);

    await runMarginSweep(prisma, { now: new Date() });
    const search = await gql(QUEUE, { filter: { search: "fairbanks" } });
    expect(search.data.exceptions.length).toBeGreaterThan(0);
    expect(search.data.exceptions.every((e: any) => e.account.id === "ACC-1015")).toBe(true);
  });

  it("shows before/after margin for an account through a scenario run", async () => {
    const spin = await gql(SPIN, { seed: "s-1" });
    const res = await gql(
      `query($run: ID) { account(id: "ACC-1015") { margin(scenarioRunId: $run) {
          before { equity breached } after { equity breached } positions { symbol shockedPrice pnl } } } }`,
      { run: spin.data.spinWheel.id },
    );
    const m = res.data.account.margin;
    expect(m.before.breached).toBe(true);
    expect(m.after).not.toBeNull();
    expect(m.positions.every((p: any) => p.shockedPrice !== null)).toBe(true);
  });

  it("queueStats sums open deficit", async () => {
    await runMarginSweep(prisma, { now: new Date() });
    const res = await gql(`{ queueStats { open openDeficit } }`);
    expect(res.data.queueStats.open).toBeGreaterThan(0);
    expect(res.data.queueStats.openDeficit).toBeGreaterThan(0);
  });
});

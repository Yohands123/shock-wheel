import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@shock/shared";
import { calibrate, calibrationProblems, MAX_BREACH_SHARE, seedBooks } from "../src/calibration";

// Pure: computed from the seed definitions, no database.

describe("seed calibration", () => {
  const c = calibrate();

  it("passes every rule (run `pnpm --filter @shock/api calibrate` to see the matrix)", () => {
    expect(calibrationProblems(c)).toEqual([]);
  });

  it("starts with exactly one breached account, and it isn't hit by every scenario", () => {
    expect(c.startBreached).toHaveLength(1);
    expect(c.breachShare[c.startBreached[0]]).toBeLessThanOrEqual(MAX_BREACH_SHARE);
  });

  it("gives each scenario a distinct, non-empty set of breaches at SEVERE", () => {
    const sets = SCENARIOS.map((s) => c.severeSets[s.id].join(","));
    expect(sets.every((s) => s.length > 0)).toBe(true);
    expect(new Set(sets).size).toBe(SCENARIOS.length);
  });

  it("keeps every account at or under the 60% breach share", () => {
    expect(Math.max(...Object.values(c.breachShare))).toBeLessThanOrEqual(MAX_BREACH_SHARE);
  });

  it("flags the problems it is meant to catch", () => {
    // Make every account a near-copy of a deeply levered book: all start breached and all breach everywhere
    const books = seedBooks().map((b) => ({ ...b, account: { ...b.account, cash: -1e9 } }));
    const problems = calibrationProblems(calibrate(books));
    expect(problems.some((p) => p.includes("start breached"))).toBe(true);
    expect(problems.some((p) => p.includes("% of combos"))).toBe(true);
    expect(problems.some((p) => p.includes("same accounts as"))).toBe(true);
  });
});

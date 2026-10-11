import { describe, expect, it } from "vitest";
import {
  applyShock, computeMargin, priorityFor, stressAccount,
} from "./margin";
import { scenarioById, SCENARIOS } from "./scenarios";
import { spinOutcome } from "./rng";
import type { AccountInput, PositionInput } from "./types";

const acct = (cash: number): AccountInput => ({
  id: "A1", cash, longMaintPct: 0.25, shortMaintPct: 0.3,
});
const hormuz = scenarioById("hormuz-closure");

describe("computeMargin", () => {
  it("is healthy for an unlevered long book", () => {
    const m = computeMargin(acct(0), [{ qty: 100, price: 100 }]);
    expect(m.equity).toBe(10_000);
    expect(m.maintenanceRequirement).toBe(2_500);
    expect(m.breached).toBe(false);
    expect(m.deficit).toBe(0);
  });

  it("breaches when a margin loan eats the equity cushion", () => {
    // 10k long, 8k loan -> 2k equity vs 2.5k requirement
    const m = computeMargin(acct(-8_000), [{ qty: 100, price: 100 }]);
    expect(m.equity).toBe(2_000);
    expect(m.deficit).toBe(500);
    expect(m.breached).toBe(true);
  });

  it("treats negative quantity as a short and applies the short rate", () => {
    // short 100 @ 50 with 5k proceeds + 2k own cash
    const m = computeMargin(acct(7_000), [{ qty: -100, price: 50 }]);
    expect(m.shortMarketValue).toBe(5_000);
    expect(m.equity).toBe(2_000);
    expect(m.maintenanceRequirement).toBe(1_500);
    expect(m.breached).toBe(false);
  });

  it("adds the house bump to both long and short requirements", () => {
    const m = computeMargin(acct(0), [{ qty: 10, price: 100 }, { qty: -10, price: 100 }], 0.1);
    expect(m.maintenanceRequirement).toBeCloseTo(1_000 * 0.35 + 1_000 * 0.4);
  });

  it("returns a null ratio for a flat account", () => {
    const m = computeMargin(acct(5_000), []);
    expect(m.equityRatio).toBeNull();
    expect(m.breached).toBe(false);
  });

  it("rejects a negative house bump", () => {
    expect(() => computeMargin(acct(0), [], -0.1)).toThrow();
  });
});

describe("applyShock", () => {
  it("uses the sector shock and falls back to BROAD_MARKET", () => {
    const [energy, utility] = applyShock(
      [
        { symbol: "XOM", sector: "ENERGY", qty: 10, price: 100 },
        { symbol: "DUK", sector: "UTILITIES", qty: 10, price: 100 },
      ],
      hormuz,
      1,
    );
    expect(energy.shockedPrice).toBe(135);
    expect(utility.shockedPrice).toBe(95); // BROAD_MARKET -5%
  });

  it("never pushes a price below zero on tail severity", () => {
    const crypto = scenarioById("crypto-exchange-collapse");
    const [p] = applyShock([{ symbol: "BTCX", sector: "CRYPTO", qty: 1, price: 40 }], crypto, 2);
    expect(p.shockedPrice).toBe(0);
  });

  it("reports pnl with the sign of the position", () => {
    const [short] = applyShock([{ symbol: "XOM", sector: "ENERGY", qty: -10, price: 100 }], hormuz, 1);
    expect(short.pnl).toBe(-350);
  });
});

describe("stressAccount", () => {
  const shortOil: PositionInput[] = [{ symbol: "XOM", sector: "ENERGY", qty: -200, price: 110 }];

  it("Hormuz squeezes an energy short into a breach", () => {
    // 22k short proceeds + 9k own cash: 9k equity vs 6.6k requirement before
    const { before, after } = stressAccount(acct(31_000), shortOil, hormuz, 1);
    expect(before.breached).toBe(false);
    expect(after.breached).toBe(true);
    expect(priorityFor(after)).toMatch(/HIGH|CRITICAL/);
  });

  it("a hedged book survives the same shock", () => {
    // Same short and cash, plus fully paid energy and tanker longs
    const hedged: PositionInput[] = [
      ...shortOil,
      { symbol: "FRO", sector: "TANKERS", qty: 300, price: 25 },
      { symbol: "XLE", sector: "ENERGY", qty: 150, price: 90 },
    ];
    const { after } = stressAccount(acct(31_000), hedged, hormuz, 1);
    expect(after.breached).toBe(false);
  });

  it("mild severity hurts less than tail", () => {
    const airlines: PositionInput[] = [{ symbol: "DAL", sector: "AIRLINES", qty: 400, price: 50 }];
    const mild = stressAccount(acct(-10_000), airlines, hormuz, 0.5).after;
    const tail = stressAccount(acct(-10_000), airlines, hormuz, 2).after;
    expect(tail.equity).toBeLessThan(mild.equity);
    expect(tail.deficit).toBeGreaterThan(mild.deficit);
  });
});

describe("priorityFor", () => {
  it("escalates priority with the size of the deficit", () => {
    const base = { longMarketValue: 0, shortMarketValue: 0, equityRatio: 0 };
    expect(priorityFor({ ...base, equity: 100, maintenanceRequirement: 100, deficit: 0, breached: false })).toBe("LOW");
    expect(priorityFor({ ...base, equity: 90, maintenanceRequirement: 100, deficit: 10, breached: true })).toBe("MEDIUM");
    expect(priorityFor({ ...base, equity: 70, maintenanceRequirement: 100, deficit: 30, breached: true })).toBe("HIGH");
    expect(priorityFor({ ...base, equity: -5, maintenanceRequirement: 100, deficit: 105, breached: true })).toBe("CRITICAL");
  });
});

describe("spinOutcome", () => {
  it("is reproducible for the same seed", () => {
    expect(spinOutcome("abc123", SCENARIOS.length)).toEqual(spinOutcome("abc123", SCENARIOS.length));
  });

  it("stays within the slice range across many seeds", () => {
    for (let i = 0; i < 500; i++) {
      const { sliceIndex } = spinOutcome(`seed-${i}`, SCENARIOS.length);
      expect(sliceIndex).toBeGreaterThanOrEqual(0);
      expect(sliceIndex).toBeLessThan(SCENARIOS.length);
    }
  });
});

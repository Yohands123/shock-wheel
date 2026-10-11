import { SCENARIOS, SEVERITY_MULTIPLIER, computeMargin, stressAccount, type AccountInput, type PositionInput, type Scenario, type SeverityLabel } from "@shock/shared";
import { ACCOUNTS, INSTRUMENTS, seedCash } from "./seedData";

/**
 * Seed-data calibration, computed in memory from the seed definitions (no database).
 * Used by scripts/calibrate.ts to print the matrix and by tests to hold the demo balanced.
 */

// Mirrors the Prisma column defaults on Account
const LONG_MAINT = 0.25;
const SHORT_MAINT = 0.3;

export const SEVERITIES: SeverityLabel[] = ["MILD", "SEVERE", "TAIL"];

export interface SeedBook {
  account: AccountInput & { name: string };
  positions: PositionInput[];
}

export function seedBooks(): SeedBook[] {
  return ACCOUNTS.map((a) => ({
    account: { id: a.id, name: a.name, cash: seedCash(a), longMaintPct: LONG_MAINT, shortMaintPct: SHORT_MAINT },
    positions: Object.entries(a.positions).map(([symbol, qty]) => {
      const inst = INSTRUMENTS.find((i) => i.symbol === symbol);
      if (!inst) throw new Error(`Seed account ${a.id} holds unknown symbol ${symbol}`);
      return { symbol, qty, sector: inst.sector, price: inst.price };
    }),
  }));
}

export interface Calibration {
  books: SeedBook[];
  scenarios: Scenario[];
  /** breached[accountIndex][scenarioIndex][severityIndex] */
  breached: boolean[][][];
  /** Accounts in breach before any shock */
  startBreached: string[];
  /** Share of scenario/severity combos each account breaches in, by account id */
  breachShare: Record<string, number>;
  /** Accounts breached at SEVERE, per scenario id */
  severeSets: Record<string, string[]>;
}

export function calibrate(books = seedBooks(), scenarios: Scenario[] = SCENARIOS): Calibration {
  const breached = books.map((b) =>
    scenarios.map((s) => SEVERITIES.map((sev) => stressAccount(b.account, b.positions, s, SEVERITY_MULTIPLIER[sev]).after.breached)),
  );
  const combos = scenarios.length * SEVERITIES.length;
  const severeIdx = SEVERITIES.indexOf("SEVERE");
  return {
    books,
    scenarios,
    breached,
    startBreached: books.filter((b) => computeMargin(b.account, b.positions).breached).map((b) => b.account.id),
    breachShare: Object.fromEntries(books.map((b, i) => [b.account.id, breached[i].flat().filter(Boolean).length / combos])),
    severeSets: Object.fromEntries(
      scenarios.map((s, j) => [s.id, books.filter((_, i) => breached[i][j][severeIdx]).map((b) => b.account.id)]),
    ),
  };
}

export const MAX_BREACH_SHARE = 0.6;

/** The rules the demo data must satisfy. Empty array = balanced. */
export function calibrationProblems(c: Calibration): string[] {
  const problems: string[] = [];
  if (c.startBreached.length > 1) problems.push(`${c.startBreached.length} accounts start breached (max 1): ${c.startBreached.join(", ")}`);
  for (const [id, share] of Object.entries(c.breachShare)) {
    if (share > MAX_BREACH_SHARE) problems.push(`${id} breaches in ${(share * 100).toFixed(0)}% of combos (max ${MAX_BREACH_SHARE * 100}%)`);
  }
  const seen = new Map<string, string>();
  for (const [scenarioId, set] of Object.entries(c.severeSets)) {
    if (set.length === 0) problems.push(`${scenarioId} breaches nobody at SEVERE`);
    const key = set.join(",");
    const other = seen.get(key);
    if (other) problems.push(`${scenarioId} breaches the same accounts as ${other} at SEVERE (${key || "none"})`);
    else seen.set(key, scenarioId);
  }
  return problems;
}

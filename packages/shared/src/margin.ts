import type {
  AccountInput, ExceptionPriority, MarginResult, PositionInput,
  Scenario, ShockedPosition,
} from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function shockFor(scenario: Scenario, sector: PositionInput["sector"]): number {
  return scenario.sectorShocks[sector] ?? scenario.sectorShocks.BROAD_MARKET;
}

/** Apply a scenario's sector shocks to positions, scaled by severity. Pure. */
export function applyShock(
  positions: PositionInput[],
  scenario: Scenario,
  severity: number,
): ShockedPosition[] {
  return positions.map((p) => {
    // A price can fall at most 100%: clamp so tail events never go negative.
    const shockPct = Math.max(-1, shockFor(scenario, p.sector) * severity);
    const shockedPrice = round2(p.price * (1 + shockPct));
    const marketValue = round2(p.qty * p.price);
    const shockedMarketValue = round2(p.qty * shockedPrice);
    return {
      ...p,
      shockPct,
      shockedPrice,
      marketValue,
      shockedMarketValue,
      pnl: round2(shockedMarketValue - marketValue),
    };
  });
}

/**
 * Maintenance margin check.
 *   equity = cash + longMV - |shortMV|
 *   requirement = longMV * (longMaint + bump) + |shortMV| * (shortMaint + bump)
 */
export function computeMargin(
  account: AccountInput,
  positions: Array<Pick<PositionInput, "qty" | "price">>,
  houseMarginBump = 0,
): MarginResult {
  if (houseMarginBump < 0) throw new Error("houseMarginBump cannot be negative");

  let longMV = 0;
  let shortMV = 0;
  for (const p of positions) {
    const mv = p.qty * p.price;
    if (mv >= 0) longMV += mv;
    else shortMV += -mv;
  }

  const equity = account.cash + longMV - shortMV;
  const maintenanceRequirement =
    longMV * (account.longMaintPct + houseMarginBump) +
    shortMV * (account.shortMaintPct + houseMarginBump);
  const deficit = Math.max(0, maintenanceRequirement - equity);
  const gross = longMV + shortMV;

  return {
    longMarketValue: round2(longMV),
    shortMarketValue: round2(shortMV),
    equity: round2(equity),
    maintenanceRequirement: round2(maintenanceRequirement),
    deficit: round2(deficit),
    breached: deficit > 0,
    equityRatio: gross === 0 ? null : Math.round((equity / gross) * 10000) / 10000,
  };
}

/** Shock a book and check margin under the scenario's stressed house requirement. */
export function stressAccount(
  account: AccountInput,
  positions: PositionInput[],
  scenario: Scenario,
  severity: number,
) {
  const shocked = applyShock(positions, scenario, severity);
  const before = computeMargin(account, positions);
  const after = computeMargin(
    account,
    shocked.map((p) => ({ qty: p.qty, price: p.shockedPrice })),
    scenario.houseMarginBump * Math.min(severity, 1.5),
  );
  return { shocked, before, after };
}

/** Priority from the deficit as a share of the requirement. */
export function priorityFor(m: MarginResult): ExceptionPriority {
  if (!m.breached) return "LOW";
  if (m.equity <= 0) return "CRITICAL";
  const share = m.deficit / Math.max(m.maintenanceRequirement, 1);
  if (share >= 0.5) return "CRITICAL";
  if (share >= 0.2) return "HIGH";
  if (share >= 0.05) return "MEDIUM";
  return "LOW";
}

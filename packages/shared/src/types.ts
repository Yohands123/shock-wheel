export const SECTORS = [
  "ENERGY", "TANKERS", "DEFENSE", "AIRLINES", "CRUISE", "CHEMICALS",
  "INSURANCE", "TECH", "SEMIS", "BANKS", "CRYPTO", "UTILITIES", "BROAD_MARKET",
] as const;
export type Sector = (typeof SECTORS)[number];

export interface PositionInput {
  symbol: string;
  sector: Sector;
  /** Negative quantity = short position */
  qty: number;
  price: number;
}

export interface AccountInput {
  id: string;
  /** Negative cash = margin loan. Short sale proceeds sit in cash. */
  cash: number;
  /** Maintenance requirement on long market value, e.g. 0.25 */
  longMaintPct: number;
  /** Maintenance requirement on short market value, e.g. 0.30 */
  shortMaintPct: number;
}

export interface Scenario {
  id: string;
  name: string;
  /** Wheel label, max 14 characters. The full name appears in the result panel. */
  shortLabel: string;
  blurb: string;
  /** Fractional price move per sector, e.g. 0.35 = +35%. BROAD_MARKET is the fallback. */
  sectorShocks: Partial<Record<Sector, number>> & { BROAD_MARKET: number };
  /** Extra maintenance % the house adds when volatility spikes */
  houseMarginBump: number;
  /** Seeds for the explanation agent */
  factors: string[];
  /** Wheel slice colour */
  color: string;
}

export type SeverityLabel = "MILD" | "SEVERE" | "TAIL";
export const SEVERITY_MULTIPLIER: Record<SeverityLabel, number> = {
  MILD: 0.5,
  SEVERE: 1,
  TAIL: 2,
};

export interface ShockedPosition extends PositionInput {
  shockPct: number;
  shockedPrice: number;
  marketValue: number;
  shockedMarketValue: number;
  pnl: number;
}

export interface MarginResult {
  longMarketValue: number;
  shortMarketValue: number;
  equity: number;
  maintenanceRequirement: number;
  deficit: number;
  breached: boolean;
  /** equity / gross market value; null when flat */
  equityRatio: number | null;
}

export type ExceptionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

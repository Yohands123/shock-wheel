import type { PrismaClient } from "@prisma/client";
import type { Sector } from "@shock/shared";

export const USERS = [
  { id: "system", name: "Margin sweep", role: "system" },
  { id: "u-maya", name: "Maya Okafor", role: "analyst" },
  { id: "u-theo", name: "Theo Laurent", role: "analyst" },
  { id: "u-priya", name: "Priya Raman", role: "supervisor" },
];

/** Illustrative prices for a demo price feed, not live quotes. */
export const INSTRUMENTS: Array<{ symbol: string; name: string; sector: Sector; price: number }> = [
  { symbol: "XOM", name: "Exxon Mobil", sector: "ENERGY", price: 112 },
  { symbol: "CVX", name: "Chevron", sector: "ENERGY", price: 155 },
  { symbol: "XLE", name: "Energy Select SPDR", sector: "ENERGY", price: 90 },
  { symbol: "FRO", name: "Frontline", sector: "TANKERS", price: 24 },
  { symbol: "STNG", name: "Scorpio Tankers", sector: "TANKERS", price: 60 },
  { symbol: "LMT", name: "Lockheed Martin", sector: "DEFENSE", price: 460 },
  { symbol: "DAL", name: "Delta Air Lines", sector: "AIRLINES", price: 48 },
  { symbol: "UAL", name: "United Airlines", sector: "AIRLINES", price: 72 },
  { symbol: "CCL", name: "Carnival", sector: "CRUISE", price: 21 },
  { symbol: "DOW", name: "Dow Inc.", sector: "CHEMICALS", price: 40 },
  { symbol: "TRV", name: "Travelers", sector: "INSURANCE", price: 240 },
  { symbol: "ALL", name: "Allstate", sector: "INSURANCE", price: 190 },
  { symbol: "AAPL", name: "Apple", sector: "TECH", price: 225 },
  { symbol: "MSFT", name: "Microsoft", sector: "TECH", price: 420 },
  { symbol: "NVDA", name: "NVIDIA", sector: "SEMIS", price: 135 },
  { symbol: "AMD", name: "AMD", sector: "SEMIS", price: 150 },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "BANKS", price: 230 },
  { symbol: "COIN", name: "Coinbase", sector: "CRYPTO", price: 240 },
  { symbol: "IBIT", name: "iShares Bitcoin Trust", sector: "CRYPTO", price: 55 },
  { symbol: "DUK", name: "Duke Energy", sector: "UTILITIES", price: 112 },
  { symbol: "SPY", name: "SPDR S&P 500", sector: "BROAD_MARKET", price: 580 },
];

interface SeedAccount {
  id: string;
  name: string;
  owner: string;
  riskProfile: string;
  /** Margin loan as a fraction of long market value */
  loanPct: number;
  /** Own collateral as a fraction of short market value */
  shortCollateralPct?: number;
  positions: Record<string, number>;
}

/** Books are built so different wheel slices hurt different accounts. */
export const ACCOUNTS: SeedAccount[] = [
  { id: "ACC-1001", name: "Halvorsen Capital", owner: "Erik Halvorsen", riskProfile: "Aggressive", loanPct: 0, shortCollateralPct: 0.42, positions: { XOM: -300, CVX: -100 } },
  { id: "ACC-1002", name: "Brightwater Family Trust", owner: "Dana Brightwater", riskProfile: "Growth", loanPct: 0.64, positions: { DAL: 600, UAL: 300 } },
  { id: "ACC-1003", name: "Pemberton Pairs", owner: "Leo Pemberton", riskProfile: "Hedged", loanPct: 0.2, shortCollateralPct: 0.5, positions: { XOM: -200, FRO: 800, XLE: 250 } },
  { id: "ACC-1004", name: "Nakamura Growth", owner: "Ken Nakamura", riskProfile: "Aggressive", loanPct: 0.6, positions: { AAPL: 100, MSFT: 60, NVDA: 200 } },
  { id: "ACC-1005", name: "Ostrowski Semis", owner: "Anna Ostrowski", riskProfile: "Speculative", loanPct: 0.58, positions: { NVDA: 400, AMD: 200 } },
  { id: "ACC-1006", name: "Vega Digital", owner: "Marco Vega", riskProfile: "Speculative", loanPct: 0.5, positions: { COIN: 150, IBIT: 600 } },
  { id: "ACC-1007", name: "Whitfield Income", owner: "Ruth Whitfield", riskProfile: "Conservative", loanPct: 0, positions: { DUK: 300, SPY: 50 } },
  { id: "ACC-1008", name: "Castellano Value", owner: "Sofia Castellano", riskProfile: "Value", loanPct: 0.6, positions: { TRV: 100, ALL: 120 } },
  { id: "ACC-1009", name: "Adeyemi Rebound", owner: "Tunde Adeyemi", riskProfile: "Speculative", loanPct: 0.62, positions: { CCL: 2000, DAL: 300 } },
  { id: "ACC-1010", name: "Grayson Macro", owner: "Hal Grayson", riskProfile: "Aggressive", loanPct: 0, shortCollateralPct: 0.45, positions: { FRO: -1500, STNG: -300 } },
  { id: "ACC-1011", name: "Lindqvist Balanced", owner: "Ingrid Lindqvist", riskProfile: "Balanced", loanPct: 0.15, positions: { SPY: 80, JPM: 40, XLE: 60 } },
  { id: "ACC-1012", name: "Moreau Defense", owner: "Claire Moreau", riskProfile: "Growth", loanPct: 0.4, positions: { LMT: 40, MSFT: 20 } },
  { id: "ACC-1013", name: "Kowalczyk Financials", owner: "Piotr Kowalczyk", riskProfile: "Growth", loanPct: 0.55, positions: { JPM: 150, COIN: 30 } },
  { id: "ACC-1014", name: "Reyes Utilities", owner: "Lucia Reyes", riskProfile: "Income", loanPct: 0.62, positions: { DUK: 500 } },
  { id: "ACC-1015", name: "Fairbanks Macro", owner: "Owen Fairbanks", riskProfile: "Aggressive", loanPct: 0.22, shortCollateralPct: 0.1, positions: { XOM: 200, DAL: -800, CCL: -1000 } },
  { id: "ACC-1016", name: "Sterling Momentum", owner: "Jade Sterling", riskProfile: "Speculative", loanPct: 0.6, positions: { NVDA: 150, COIN: 60 } },
];

export function seedCash(a: SeedAccount): number {
  const price = (s: string) => INSTRUMENTS.find((i) => i.symbol === s)!.price;
  let longMV = 0;
  let shortMV = 0;
  for (const [sym, qty] of Object.entries(a.positions)) {
    const mv = qty * price(sym);
    if (mv > 0) longMV += mv;
    else shortMV += -mv;
  }
  const cash = -a.loanPct * longMV + shortMV * (1 + (a.shortCollateralPct ?? 0));
  return Math.round(cash * 100) / 100;
}

export async function seedDatabase(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.exception.deleteMany(),
    prisma.scenarioRun.deleteMany(),
    prisma.position.deleteMany(),
    prisma.account.deleteMany(),
    prisma.priceTick.deleteMany(),
    prisma.instrument.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.user.createMany({ data: USERS });
  await prisma.instrument.createMany({ data: INSTRUMENTS });
  await prisma.priceTick.createMany({
    data: INSTRUMENTS.map((i) => ({ symbol: i.symbol, price: i.price })),
  });

  for (const a of ACCOUNTS) {
    await prisma.account.create({
      data: {
        id: a.id,
        name: a.name,
        owner: a.owner,
        riskProfile: a.riskProfile,
        cash: seedCash(a),
        positions: {
          create: Object.entries(a.positions).map(([symbol, qty]) => ({ symbol, qty })),
        },
      },
    });
  }
}

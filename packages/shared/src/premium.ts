/**
 * Renewal roulette: an illustrative home insurance premium model.
 *
 * NOT a rating engine. Hazard scores, shock sizes and loadings below are illustrative
 * parameters chosen to make the demo behave sensibly; real premiums depend on each
 * insurer's rating and policy wording. Everything here is pure: no randomness, no I/O.
 */
import { spinOutcome } from "./rng";

/* ---------- Types ---------- */

export const PERILS = ["WIND", "WILDFIRE", "FLOOD", "HAIL", "WATER_BACKUP", "EARTHQUAKE", "WINTER"] as const;
export type Peril = (typeof PERILS)[number];
export type PerilScores = Record<Peril, number>;

export const PERIL_LABEL: Record<Peril, string> = {
  WIND: "Wind",
  WILDFIRE: "Wildfire",
  FLOOD: "Flood",
  HAIL: "Hail",
  WATER_BACKUP: "Water backup",
  EARTHQUAKE: "Earthquake",
  WINTER: "Winter freeze",
};

export type Construction = "WOOD_FRAME" | "MASONRY" | "CONCRETE";
export type DistanceToWater = "UNDER_500M" | "500M_TO_2KM" | "OVER_2KM";
export type Endorsement = "OVERLAND_FLOOD" | "SEWER_BACKUP" | "EARTHQUAKE";
export const ENDORSEMENTS: Endorsement[] = ["OVERLAND_FLOOD", "SEWER_BACKUP", "EARTHQUAKE"];

export interface HouseProfile {
  label: string;
  region: RegionId;
  /** Display only */
  areaNote: string;
  replacementCost: number;
  yearBuilt: number;
  roofAgeYears: number;
  construction: Construction;
  distanceToWater: DistanceToWater;
  /** Backs onto forest or brush */
  wildlandInterface: boolean;
  /** 0-5 */
  claimsLast5Years: number;
  deductible: number;
  currentAnnualPremium: number;
  endorsements: Endorsement[];
}

/* ---------- Regions (illustrative hazard scores, 0-1) ---------- */

export interface Region {
  id: RegionId;
  name: string;
  country: "CA" | "US";
  /** Illustrative only, not actuarial data */
  hazards: PerilScores;
}

export type RegionId =
  | "SOUTHERN_ONTARIO"
  | "CALGARY"
  | "INTERIOR_BC"
  | "COASTAL_BC"
  | "FLORIDA_GULF"
  | "NORTHERN_CALIFORNIA"
  | "TEXAS_GULF"
  | "MIDWEST_US";

// Illustrative hazard scores. Chosen to give each region a recognisable profile, not measured.
export const REGIONS: Region[] = [
  { id: "SOUTHERN_ONTARIO", name: "Southern Ontario", country: "CA", hazards: { WIND: 0.3, WILDFIRE: 0.05, FLOOD: 0.35, HAIL: 0.25, WATER_BACKUP: 0.6, EARTHQUAKE: 0.05, WINTER: 0.5 } },
  { id: "CALGARY", name: "Calgary", country: "CA", hazards: { WIND: 0.35, WILDFIRE: 0.2, FLOOD: 0.35, HAIL: 0.9, WATER_BACKUP: 0.3, EARTHQUAKE: 0.05, WINTER: 0.7 } },
  { id: "INTERIOR_BC", name: "Interior BC", country: "CA", hazards: { WIND: 0.2, WILDFIRE: 0.9, FLOOD: 0.4, HAIL: 0.2, WATER_BACKUP: 0.2, EARTHQUAKE: 0.2, WINTER: 0.5 } },
  { id: "COASTAL_BC", name: "Coastal BC", country: "CA", hazards: { WIND: 0.35, WILDFIRE: 0.25, FLOOD: 0.45, HAIL: 0.05, WATER_BACKUP: 0.45, EARTHQUAKE: 0.8, WINTER: 0.25 } },
  { id: "FLORIDA_GULF", name: "Florida Gulf Coast", country: "US", hazards: { WIND: 1.0, WILDFIRE: 0.1, FLOOD: 0.9, HAIL: 0.15, WATER_BACKUP: 0.3, EARTHQUAKE: 0.02, WINTER: 0.02 } },
  { id: "NORTHERN_CALIFORNIA", name: "Northern California", country: "US", hazards: { WIND: 0.15, WILDFIRE: 1.0, FLOOD: 0.25, HAIL: 0.05, WATER_BACKUP: 0.15, EARTHQUAKE: 0.85, WINTER: 0.1 } },
  { id: "TEXAS_GULF", name: "Texas Gulf Coast", country: "US", hazards: { WIND: 0.85, WILDFIRE: 0.2, FLOOD: 0.8, HAIL: 0.6, WATER_BACKUP: 0.3, EARTHQUAKE: 0.03, WINTER: 0.3 } },
  { id: "MIDWEST_US", name: "Midwest US", country: "US", hazards: { WIND: 0.55, WILDFIRE: 0.05, FLOOD: 0.45, HAIL: 0.75, WATER_BACKUP: 0.4, EARTHQUAKE: 0.1, WINTER: 0.6 } },
];

export function regionById(id: RegionId): Region {
  const r = REGIONS.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown region: ${id}`);
  return r;
}

export const DEFAULT_HOUSE: HouseProfile = {
  label: "My house",
  region: "SOUTHERN_ONTARIO",
  areaNote: "",
  replacementCost: 650_000,
  yearBuilt: 1995,
  roofAgeYears: 12,
  construction: "WOOD_FRAME",
  distanceToWater: "500M_TO_2KM",
  wildlandInterface: false,
  claimsLast5Years: 0,
  deductible: 1_000,
  currentAnnualPremium: 2_400,
  endorsements: ["SEWER_BACKUP"],
};

/* ---------- Exposure ---------- */

export const EXPOSURE_MAX = 1.5;
const clampExposure = (n: number) => Math.min(EXPOSURE_MAX, Math.max(0, n));

/** Per-peril exposure: region score times house modifiers, clamped to 0..1.5. */
export function exposure(profile: HouseProfile): PerilScores {
  const h = regionById(profile.region).hazards;
  const m: PerilScores = { WIND: 1, WILDFIRE: 1, FLOOD: 1, HAIL: 1, WATER_BACKUP: 1, EARTHQUAKE: 1, WINTER: 1 };

  // Distance to water: close raises flood, and wind where the region is windy (coasts)
  if (profile.distanceToWater === "UNDER_500M") {
    m.FLOOD *= 1.6;
    m.WIND *= h.WIND >= 0.5 ? 1.2 : 1.05;
  } else if (profile.distanceToWater === "500M_TO_2KM") {
    m.FLOOD *= 1.15;
  } else {
    m.FLOOD *= 0.7;
  }

  m.WILDFIRE *= profile.wildlandInterface ? 1.8 : 0.6;

  if (profile.roofAgeYears > 15) {
    m.WIND *= 1.25;
    m.HAIL *= 1.3;
  } else if (profile.roofAgeYears <= 5) {
    m.WIND *= 0.9;
    m.HAIL *= 0.85;
  }

  if (profile.construction === "MASONRY") {
    m.WILDFIRE *= 0.7;
    m.WIND *= 0.85;
    m.EARTHQUAKE *= 1.15; // unreinforced masonry does worse in quakes
  } else if (profile.construction === "CONCRETE") {
    m.WILDFIRE *= 0.55;
    m.WIND *= 0.75;
  }

  // Older plumbing and drains
  if (profile.yearBuilt < 1970) m.WATER_BACKUP *= 1.2;

  return Object.fromEntries(PERILS.map((p) => [p, clampExposure(h[p] * m[p])])) as PerilScores;
}

/* ---------- Wheel events ---------- */

export type EventKind = "PERIL" | "MARKET" | "PERSONAL";

export interface MarketFactors {
  /** Share of a reinsurance price rise passed through, scaled by catastrophe exposure */
  reinsurancePassThrough: number;
  /** Rebuild cost inflation; lifts the premium and the replacement cost */
  constructionInflation: number;
  /** Insurers pulling back; prices up where exposure is high */
  capacityCut: number;
  /** Maximum increase a regulator allows this year, or null */
  rateCap: number | null;
}

export interface RenewalEvent {
  id: string;
  /** Wheel label, max 14 characters */
  shortLabel: string;
  name: string;
  blurb: string;
  /** Wheel slice colour (white label) */
  color: string;
  kind: EventKind;
  /** True for events that usually lower the premium (rendered in the cleared green) */
  lowersPremium: boolean;
  /** Fractional premium pressure per unit of exposure, e.g. WIND 0.5 */
  perilShocks: Partial<Record<Peril, number>>;
  marketFactors: MarketFactors;
  personal?: { roofReset?: boolean; claimsDelta?: -1 | 1 };
}

const NO_MARKET: MarketFactors = { reinsurancePassThrough: 0, constructionInflation: 0, capacityCut: 0, rateCap: null };

// Illustrative shock sizes. Order matters: spinOutcome's slice index indexes this array.
// Premium-lowering events sit at even indices, the wheel's dark slots, so they render solid cleared green.
export const RENEWAL_EVENTS: RenewalEvent[] = [
  { id: "hurricane", shortLabel: "Hurricane", name: "Hurricane landfall", blurb: "A major hurricane comes ashore and insurers reprice wind risk.", color: "#2C3E57", kind: "PERIL", lowersPremium: false, perilShocks: { WIND: 0.5, FLOOD: 0.25, WATER_BACKUP: 0.05 }, marketFactors: NO_MARKET },
  { id: "reinsurance-spike", shortLabel: "Reinsurance up", name: "Reinsurance costs spike", blurb: "Global reinsurers raise prices after a heavy catastrophe year.", color: "#5C4B6E", kind: "MARKET", lowersPremium: false, perilShocks: {}, marketFactors: { ...NO_MARKET, reinsurancePassThrough: 0.12 } },
  { id: "new-roof", shortLabel: "New roof", name: "New roof installed", blurb: "You replace the roof; wind and hail risk drop.", color: "#2F7A57", kind: "PERSONAL", lowersPremium: true, perilShocks: {}, marketFactors: NO_MARKET, personal: { roofReset: true } },
  { id: "wildfire-season", shortLabel: "Wildfire", name: "Wildfire season", blurb: "A long, dry season brings fires close to towns.", color: "#8A3B2B", kind: "PERIL", lowersPremium: false, perilShocks: { WILDFIRE: 0.55 }, marketFactors: NO_MARKET },
  { id: "spring-flood", shortLabel: "Spring flood", name: "Spring flood", blurb: "Snowmelt and heavy rain push rivers over their banks.", color: "#2F5E6E", kind: "PERIL", lowersPremium: false, perilShocks: { FLOOD: 0.45, WATER_BACKUP: 0.15 }, marketFactors: NO_MARKET },
  { id: "construction-costs", shortLabel: "Build costs up", name: "Construction costs jump", blurb: "Lumber, labour and materials get pricier, so rebuilds cost more.", color: "#6B5A3A", kind: "MARKET", lowersPremium: false, perilShocks: {}, marketFactors: { ...NO_MARKET, constructionInflation: 0.08 } },
  { id: "claims-free", shortLabel: "Claims-free", name: "Claims-free year", blurb: "Another year without a claim earns a discount.", color: "#2F7A57", kind: "PERSONAL", lowersPremium: true, perilShocks: {}, marketFactors: NO_MARKET, personal: { claimsDelta: -1 } },
  { id: "hail-storm", shortLabel: "Hail storm", name: "Hail storm", blurb: "Golf-ball hail shreds roofs and siding across the region.", color: "#4A5A7A", kind: "PERIL", lowersPremium: false, perilShocks: { HAIL: 0.45, WIND: 0.05 }, marketFactors: NO_MARKET },
  { id: "polar-vortex", shortLabel: "Polar vortex", name: "Polar vortex freeze", blurb: "A deep freeze bursts pipes across the region.", color: "#3B4F6B", kind: "PERIL", lowersPremium: false, perilShocks: { WINTER: 0.4, WATER_BACKUP: 0.1 }, marketFactors: NO_MARKET },
  { id: "insurer-exits", shortLabel: "Insurer exits", name: "Insurer exits your region", blurb: "A major insurer stops writing new homes where you live.", color: "#6B3A4A", kind: "MARKET", lowersPremium: false, perilShocks: {}, marketFactors: { ...NO_MARKET, capacityCut: 0.15 } },
  { id: "sewer-backup", shortLabel: "Sewer backup", name: "Sewer backup storm", blurb: "A cloudburst overwhelms storm drains and basements flood.", color: "#3F5F5C", kind: "PERIL", lowersPremium: false, perilShocks: { WATER_BACKUP: 0.45, FLOOD: 0.1 }, marketFactors: NO_MARKET },
  { id: "flood-maps", shortLabel: "Flood maps", name: "Flood maps redrawn", blurb: "New maps put more streets inside the flood zone.", color: "#4B4F7A", kind: "MARKET", lowersPremium: false, perilShocks: { FLOOD: 0.3 }, marketFactors: NO_MARKET },
  { id: "earthquake-swarm", shortLabel: "Quake swarm", name: "Earthquake swarm", blurb: "A run of small quakes revives fears of a big one.", color: "#5A4A3A", kind: "PERIL", lowersPremium: false, perilShocks: { EARTHQUAKE: 0.5 }, marketFactors: NO_MARKET },
  { id: "water-claim", shortLabel: "Water claim", name: "You filed a water damage claim", blurb: "A burst pipe means your first claim in years.", color: "#7A3A3A", kind: "PERSONAL", lowersPremium: false, perilShocks: { WATER_BACKUP: 0.1 }, marketFactors: NO_MARKET, personal: { claimsDelta: 1 } },
  { id: "ice-storm", shortLabel: "Ice storm", name: "Ice storm", blurb: "Freezing rain brings down trees and power lines.", color: "#2E4A5E", kind: "PERIL", lowersPremium: false, perilShocks: { WINTER: 0.3, WIND: 0.1 }, marketFactors: NO_MARKET },
  { id: "rate-cap", shortLabel: "Rate cap", name: "Regulator caps rates", blurb: "The regulator limits how much insurers can raise prices this year.", color: "#56657A", kind: "MARKET", lowersPremium: false, perilShocks: {}, marketFactors: { ...NO_MARKET, reinsurancePassThrough: 0.06, rateCap: 0.05 } },
];

export function renewalEventById(id: string): RenewalEvent {
  const e = RENEWAL_EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown renewal event: ${id}`);
  return e;
}

/* ---------- Renewal ---------- */

export const ANNUAL_TREND = 0.03;
export const CLAIM_LOADING = 0.08;
export const CLAIMS_FREE_DISCOUNT = 0.05;
export const MAX_DECREASE = -0.15;
export const MAX_INCREASE = 0.6;
const MIN_PREMIUM = 400;
const MIN_PREMIUM_RATE = 0.0008; // of replacement cost

export type NonRenewalRisk = "LOW" | "MEDIUM" | "HIGH";

export interface Driver {
  label: string;
  /** Dollars; drivers sum exactly to newPremium - previous premium */
  amount: number;
}

export interface CoverageGap {
  peril: Peril;
  endorsement: Endorsement;
  message: string;
}

export interface RenewalResult {
  previousPremium: number;
  newPremium: number;
  changePct: number;
  drivers: Driver[];
  nonRenewalRisk: NonRenewalRisk;
  coverageGaps: CoverageGap[];
  exposure: PerilScores;
  updatedProfile: HouseProfile;
}

const cents = (dollars: number) => Math.round(dollars * 100);
const fromCents = (c: number) => c / 100;

export function minimumPremium(profile: HouseProfile) {
  return Math.max(MIN_PREMIUM, profile.replacementCost * MIN_PREMIUM_RATE);
}

const GAP_RULES: Array<{ peril: Peril; endorsement: Endorsement; threshold: number; message: string }> = [
  { peril: "FLOOD", endorsement: "OVERLAND_FLOOD", threshold: 0.6, message: "High flood exposure without overland flood cover. Most standard policies exclude water that enters from outside." },
  { peril: "WATER_BACKUP", endorsement: "SEWER_BACKUP", threshold: 0.5, message: "High water backup exposure without sewer backup cover. A backed-up drain is usually excluded unless you add it." },
  { peril: "EARTHQUAKE", endorsement: "EARTHQUAKE", threshold: 0.5, message: "High earthquake exposure without earthquake cover. Standard home policies exclude quake damage." },
];

export function coverageGaps(profile: HouseProfile, exp: PerilScores = exposure(profile)): CoverageGap[] {
  return GAP_RULES.filter((g) => exp[g.peril] >= g.threshold && !profile.endorsements.includes(g.endorsement)).map(
    ({ peril, endorsement, message }) => ({ peril, endorsement, message }),
  );
}

export function nonRenewalRisk(exp: PerilScores, market: MarketFactors, claims: number): NonRenewalRisk {
  const worst = Math.max(...PERILS.map((p) => exp[p]));
  if (market.capacityCut > 0 && worst >= 1) return "HIGH";
  if ((market.capacityCut > 0 && worst >= 0.7) || worst >= 1.2 || claims >= 3) return "MEDIUM";
  return "LOW";
}

/**
 * One renewal year. Severity scales the event's peril and market effects (0.5 / 1 / 2);
 * personal events apply as-is. Every dollar of change is attributed to a driver.
 */
export function computeRenewal(profile: HouseProfile, event: RenewalEvent, severity: number): RenewalResult {
  const P0 = profile.currentAnnualPremium;
  const exp = exposure(profile);
  const scale = event.kind === "PERSONAL" ? 1 : severity;
  const m = event.marketFactors;
  const raw: Driver[] = [];
  const add = (label: string, pct: number) => {
    if (pct !== 0) raw.push({ label, amount: pct * P0 });
  };

  add("Annual rate trend", ANNUAL_TREND);

  for (const peril of PERILS) {
    const shock = event.perilShocks[peril];
    if (shock) add(`${PERIL_LABEL[peril]} risk`, shock * scale * exp[peril]);
  }

  const catExposure = (exp.WIND + exp.WILDFIRE + exp.FLOOD + exp.EARTHQUAKE) / 4;
  add("Reinsurance costs", m.reinsurancePassThrough * scale * (0.5 + catExposure));
  add("Construction costs", m.constructionInflation * scale);
  add("Insurer capacity", m.capacityCut * scale * Math.max(...PERILS.map((p) => exp[p])));

  const oldClaims = profile.claimsLast5Years;
  const newClaims = Math.min(5, Math.max(0, oldClaims + (event.personal?.claimsDelta ?? 0)));
  add("Claims history", (newClaims - oldClaims) * CLAIM_LOADING);
  if (event.personal?.claimsDelta === -1) add("Claims-free discount", -CLAIMS_FREE_DISCOUNT);

  if (event.personal?.roofReset) {
    // Credit the wind and hail exposure a new roof removes, plus a flat credit for an old roof
    const after = exposure({ ...profile, roofAgeYears: 0 });
    const removed = exp.WIND - after.WIND + (exp.HAIL - after.HAIL);
    add("New roof credit", -(0.15 * removed + (profile.roofAgeYears > 10 ? 0.06 : 0.02)));
  }

  // Work in cents so the drivers sum exactly to the change
  const drivers = raw.map((d) => ({ label: d.label, cents: cents(d.amount) }));
  const rawChange = drivers.reduce((t, d) => t + d.cents, 0);
  let change = rawChange;
  const p0c = cents(P0);

  if (m.rateCap !== null && change > cents(m.rateCap * P0)) {
    const capped = cents(m.rateCap * P0);
    drivers.push({ label: "Regulator rate cap", cents: capped - change });
    change = capped;
  }
  const hi = cents(MAX_INCREASE * P0);
  const lo = cents(MAX_DECREASE * P0);
  if (change > hi) {
    drivers.push({ label: "Annual change limit", cents: hi - change });
    change = hi;
  } else if (change < lo) {
    drivers.push({ label: "Annual change limit", cents: lo - change });
    change = lo;
  }
  const floorCents = cents(minimumPremium(profile));
  if (p0c + change < floorCents) {
    drivers.push({ label: "Minimum premium", cents: floorCents - (p0c + change) });
    change = floorCents - p0c;
  }

  const newPremium = fromCents(p0c + change);
  const updatedProfile: HouseProfile = {
    ...profile,
    roofAgeYears: event.personal?.roofReset ? 0 : profile.roofAgeYears + 1,
    claimsLast5Years: newClaims,
    replacementCost: Math.round(profile.replacementCost * (1 + m.constructionInflation * scale)),
    currentAnnualPremium: newPremium,
  };

  return {
    previousPremium: P0,
    newPremium,
    changePct: P0 === 0 ? 0 : fromCents(change) / P0,
    drivers: drivers.filter((d) => d.cents !== 0).map((d) => ({ label: d.label, amount: fromCents(d.cents) })),
    nonRenewalRisk: nonRenewalRisk(exp, m, newClaims),
    coverageGaps: coverageGaps(profile, exp),
    exposure: exp,
    updatedProfile,
  };
}

/* ---------- Multi-year path ---------- */

export interface RenewalStep {
  year: number;
  seed: string;
  event: RenewalEvent;
  severityLabel: ReturnType<typeof spinOutcome>["severityLabel"];
  severity: number;
  sliceIndex: number;
  result: RenewalResult;
}

/** Seed for a given renewal year, so one path seed reproduces every year. */
export const yearSeed = (seed: string, year: number) => `${seed}:${year}`;

/** One renewal year decided by a seed, the same way spinRenewal does on the server. */
export function renewalSpin(profile: HouseProfile, seed: string) {
  const outcome = spinOutcome(seed, RENEWAL_EVENTS.length);
  const event = RENEWAL_EVENTS[outcome.sliceIndex];
  return { ...outcome, event, result: computeRenewal(profile, event, outcome.severity) };
}

/** Simulate `years` renewals from one seed. Same profile + seed = same path. */
export function simulateRenewals(profile: HouseProfile, seed: string, years: number): RenewalStep[] {
  const steps: RenewalStep[] = [];
  let current = profile;
  for (let year = 1; year <= years; year++) {
    const s = yearSeed(seed, year);
    const spin = renewalSpin(current, s);
    steps.push({ year, seed: s, event: spin.event, severityLabel: spin.severityLabel, severity: spin.severity, sliceIndex: spin.sliceIndex, result: spin.result });
    current = spin.result.updatedProfile;
  }
  return steps;
}

import { describe, expect, it } from "vitest";
import {
  computeRenewal,
  coverageGaps,
  DEFAULT_HOUSE,
  exposure,
  EXPOSURE_MAX,
  MAX_DECREASE,
  MAX_INCREASE,
  minimumPremium,
  PERILS,
  REGIONS,
  RENEWAL_EVENTS,
  renewalEventById,
  simulateRenewals,
  type HouseProfile,
} from "./premium";

const sum = (xs: number[]) => Math.round(xs.reduce((t, x) => t + x, 0) * 100) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

const downtownMasonry: HouseProfile = {
  ...DEFAULT_HOUSE,
  label: "Downtown masonry",
  region: "INTERIOR_BC",
  construction: "MASONRY",
  wildlandInterface: false,
  distanceToWater: "OVER_2KM",
};
const wuiWoodFrame: HouseProfile = {
  ...downtownMasonry,
  label: "Wood frame backing onto forest",
  construction: "WOOD_FRAME",
  wildlandInterface: true,
};

describe("events and regions", () => {
  it("has 16 events with unique ids and wheel labels of at most 14 characters", () => {
    expect(RENEWAL_EVENTS).toHaveLength(16);
    expect(new Set(RENEWAL_EVENTS.map((e) => e.id)).size).toBe(16);
    for (const e of RENEWAL_EVENTS) expect(e.shortLabel.length, e.id).toBeLessThanOrEqual(14);
  });

  it("covers peril, market and personal events, including ones that lower the premium", () => {
    const kinds = new Set(RENEWAL_EVENTS.map((e) => e.kind));
    expect([...kinds].sort()).toEqual(["MARKET", "PERIL", "PERSONAL"]);
    expect(RENEWAL_EVENTS.filter((e) => e.lowersPremium).map((e) => e.id).sort()).toEqual(["claims-free", "new-roof"]);
  });

  it("mixes Canadian and US regions with hazard scores in 0..1", () => {
    expect(new Set(REGIONS.map((r) => r.country))).toEqual(new Set(["CA", "US"]));
    for (const r of REGIONS) for (const p of PERILS) expect(r.hazards[p]).toBeGreaterThanOrEqual(0), expect(r.hazards[p]).toBeLessThanOrEqual(1);
  });
});

describe("exposure", () => {
  it("clamps every peril to 0..1.5", () => {
    const worst: HouseProfile = { ...DEFAULT_HOUSE, region: "FLORIDA_GULF", distanceToWater: "UNDER_500M", roofAgeYears: 25, wildlandInterface: true, yearBuilt: 1950 };
    for (const v of Object.values(exposure(worst))) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(EXPOSURE_MAX);
    }
  });

  it("raises flood near water and lowers it far away", () => {
    const near = exposure({ ...DEFAULT_HOUSE, distanceToWater: "UNDER_500M" }).FLOOD;
    const far = exposure({ ...DEFAULT_HOUSE, distanceToWater: "OVER_2KM" }).FLOOD;
    expect(near).toBeGreaterThan(far * 2);
  });
});

describe("computeRenewal", () => {
  it("attributes every cent: drivers sum exactly to the change, for every event and severity", () => {
    const houses = [DEFAULT_HOUSE, downtownMasonry, wuiWoodFrame, { ...DEFAULT_HOUSE, region: "FLORIDA_GULF" as const, distanceToWater: "UNDER_500M" as const }];
    for (const h of houses) {
      for (const e of RENEWAL_EVENTS) {
        for (const sev of [0.5, 1, 2]) {
          const r = computeRenewal(h, e, sev);
          expect(sum(r.drivers.map((d) => d.amount)), `${h.label} / ${e.id} / ${sev}`).toBe(round2(r.newPremium - r.previousPremium));
          expect(r.changePct).toBeGreaterThanOrEqual(MAX_DECREASE - 1e-9);
          expect(r.changePct).toBeLessThanOrEqual(MAX_INCREASE + 1e-9);
          expect(r.newPremium).toBeGreaterThanOrEqual(minimumPremium(h) - 0.005);
        }
      }
    }
  });

  it("wildfire barely moves a downtown masonry house but hits a wood frame house backing onto forest", () => {
    const wildfire = renewalEventById("wildfire-season");
    const masonry = computeRenewal(downtownMasonry, wildfire, 1);
    const wui = computeRenewal(wuiWoodFrame, wildfire, 1);
    expect(masonry.changePct).toBeLessThan(0.25);
    expect(wui.changePct).toBeGreaterThan(0.5);
    expect(wui.changePct).toBeGreaterThan(masonry.changePct * 2.5);
  });

  it("a new roof lowers the premium and resets roof age", () => {
    const old = { ...DEFAULT_HOUSE, roofAgeYears: 22 };
    const r = computeRenewal(old, renewalEventById("new-roof"), 1);
    expect(r.newPremium).toBeLessThan(old.currentAnnualPremium);
    expect(r.updatedProfile.roofAgeYears).toBe(0);
    expect(r.drivers.find((d) => d.label === "New roof credit")!.amount).toBeLessThan(0);
  });

  it("a claims-free year lowers the premium and a water claim raises it", () => {
    const withClaim = { ...DEFAULT_HOUSE, claimsLast5Years: 1 };
    expect(computeRenewal(withClaim, renewalEventById("claims-free"), 1).newPremium).toBeLessThan(withClaim.currentAnnualPremium);
    const r = computeRenewal(DEFAULT_HOUSE, renewalEventById("water-claim"), 1);
    expect(r.newPremium).toBeGreaterThan(DEFAULT_HOUSE.currentAnnualPremium);
    expect(r.updatedProfile.claimsLast5Years).toBe(1);
  });

  it("a rate cap clamps the increase and shows up as its own driver", () => {
    const florida: HouseProfile = { ...DEFAULT_HOUSE, region: "FLORIDA_GULF", distanceToWater: "UNDER_500M" };
    const hurricane = renewalEventById("hurricane");
    const uncapped = computeRenewal(florida, hurricane, 1);
    const capped = computeRenewal(florida, { ...hurricane, marketFactors: { ...hurricane.marketFactors, rateCap: 0.05 } }, 1);
    expect(uncapped.changePct).toBeGreaterThan(0.05);
    expect(capped.changePct).toBeCloseTo(0.05, 4);
    expect(capped.drivers.some((d) => d.label === "Regulator rate cap" && d.amount < 0)).toBe(true);
    // The regulator event itself keeps a high-exposure house at the cap
    expect(computeRenewal(florida, renewalEventById("rate-cap"), 2).changePct).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it("clamps a single year to the annual change limit", () => {
    const florida: HouseProfile = { ...DEFAULT_HOUSE, region: "FLORIDA_GULF", distanceToWater: "UNDER_500M", roofAgeYears: 25 };
    const r = computeRenewal(florida, renewalEventById("hurricane"), 2);
    expect(r.changePct).toBeCloseTo(MAX_INCREASE, 6);
    expect(r.drivers.some((d) => d.label === "Annual change limit")).toBe(true);
  });

  it("never drops below the minimum premium", () => {
    const cheap = { ...DEFAULT_HOUSE, currentAnnualPremium: 450, replacementCost: 650_000, roofAgeYears: 30, claimsLast5Years: 1 };
    const r = computeRenewal(cheap, renewalEventById("new-roof"), 1);
    expect(r.newPremium).toBe(minimumPremium(cheap));
  });

  it("flags high non-renewal risk when exposure is high and capacity is cut", () => {
    const florida: HouseProfile = { ...DEFAULT_HOUSE, region: "FLORIDA_GULF", distanceToWater: "UNDER_500M" };
    expect(computeRenewal(florida, renewalEventById("insurer-exits"), 1).nonRenewalRisk).toBe("HIGH");
    expect(computeRenewal(DEFAULT_HOUSE, renewalEventById("insurer-exits"), 1).nonRenewalRisk).not.toBe("HIGH");
    expect(computeRenewal(florida, renewalEventById("hail-storm"), 1).nonRenewalRisk).not.toBe("HIGH");
  });
});

describe("coverage gaps", () => {
  it("flags high flood exposure without overland flood cover, and clears when the endorsement is added", () => {
    const riverside: HouseProfile = { ...DEFAULT_HOUSE, region: "TEXAS_GULF", distanceToWater: "UNDER_500M", endorsements: [] };
    expect(coverageGaps(riverside).map((g) => g.endorsement)).toContain("OVERLAND_FLOOD");
    expect(coverageGaps({ ...riverside, endorsements: ["OVERLAND_FLOOD"] }).map((g) => g.endorsement)).not.toContain("OVERLAND_FLOOD");
  });

  it("flags earthquake exposure in quake country and nothing for a low-risk house", () => {
    expect(coverageGaps({ ...DEFAULT_HOUSE, region: "COASTAL_BC", endorsements: [] }).map((g) => g.peril)).toContain("EARTHQUAKE");
    expect(coverageGaps({ ...DEFAULT_HOUSE, distanceToWater: "OVER_2KM", endorsements: ["SEWER_BACKUP"] })).toEqual([]);
  });
});

describe("simulateRenewals", () => {
  it("reproduces the same 5-year path for the same seed", () => {
    const a = simulateRenewals(DEFAULT_HOUSE, "path-seed", 5);
    const b = simulateRenewals(DEFAULT_HOUSE, "path-seed", 5);
    expect(a).toEqual(b);
    expect(a.map((s) => s.year)).toEqual([1, 2, 3, 4, 5]);
  });

  it("chains years: each year starts from the previous premium and ages the roof", () => {
    const steps = simulateRenewals({ ...DEFAULT_HOUSE, roofAgeYears: 3 }, "chain", 5);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].result.previousPremium).toBe(steps[i - 1].result.newPremium);
    }
    const resets = steps.filter((s) => s.event.personal?.roofReset).length;
    if (resets === 0) expect(steps.at(-1)!.result.updatedProfile.roofAgeYears).toBe(8);
  });

  it("differs for a different seed", () => {
    const a = simulateRenewals(DEFAULT_HOUSE, "seed-a", 5).map((s) => s.event.id);
    const b = simulateRenewals(DEFAULT_HOUSE, "seed-b", 5).map((s) => s.event.id);
    expect(a).not.toEqual(b);
  });
});

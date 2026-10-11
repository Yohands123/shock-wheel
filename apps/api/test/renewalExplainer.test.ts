import { describe, expect, it, vi } from "vitest";
import { computeRenewal, DEFAULT_HOUSE, renewalEventById, type HouseProfile } from "@shock/shared";
import {
  findUngroundedRenewalNumbers,
  renewalExplanationFromResponse,
  RenewalExplanationSchema,
  templateRenewalExplanation,
  type RenewalExplainInput,
} from "../src/services/renewalExplainer";

// Pure unit tests: no API call, no database.

function inputFor(profile: HouseProfile, eventId: string, severity = 1, severityLabel = "SEVERE"): RenewalExplainInput {
  const event = renewalEventById(eventId);
  const r = computeRenewal(profile, event, severity);
  return {
    year: 1,
    event,
    severityLabel,
    severity,
    profile,
    exposure: r.exposure,
    premiumBefore: r.previousPremium,
    premiumAfter: r.newPremium,
    changePct: r.changePct,
    drivers: r.drivers,
    nonRenewalRisk: r.nonRenewalRisk,
    coverageGaps: r.coverageGaps,
  };
}

const forest: HouseProfile = { ...DEFAULT_HOUSE, region: "INTERIOR_BC", wildlandInterface: true, distanceToWater: "OVER_2KM" };

describe("renewal explanation template", () => {
  it("matches the schema and is grounded for every event", async () => {
    const { RENEWAL_EVENTS } = await import("@shock/shared");
    for (const e of RENEWAL_EVENTS) {
      const input = inputFor(forest, e.id);
      const t = templateRenewalExplanation(input);
      expect(RenewalExplanationSchema.safeParse(t).success, e.id).toBe(true);
      expect(findUngroundedRenewalNumbers(t, input), e.id).toEqual([]);
    }
  });

  it("names the biggest driver and suggests wildfire mitigation for a forest-backed house", () => {
    const t = templateRenewalExplanation(inputFor(forest, "wildfire-season"));
    expect(t.whyItMoved[0]).toContain("Wildfire risk");
    expect(t.mitigation.join(" ")).toMatch(/ember-resistant vents/i);
    expect(t.headline).toMatch(/raises your premium/);
  });

  it("carries coverage gaps through", () => {
    const riverside: HouseProfile = { ...DEFAULT_HOUSE, region: "TEXAS_GULF", distanceToWater: "UNDER_500M", endorsements: [] };
    const t = templateRenewalExplanation(inputFor(riverside, "spring-flood"));
    expect(t.coverageGaps.join(" ")).toMatch(/overland flood/i);
  });
});

describe("renewal explanation grounding", () => {
  const input = inputFor(forest, "wildfire-season");
  const grounded = {
    headline: `Wildfire season raises your premium to $${Math.round(input.premiumAfter).toLocaleString("en-US")}.`,
    whyItMoved: [`Wildfire risk added $${Math.round(input.drivers.find((d) => d.label === "Wildfire risk")!.amount).toLocaleString("en-US")}`],
    askYourBroker: ["How is wildfire risk rated for my address?"],
    mitigation: ["Install ember-resistant vents", "Consider a higher deductible than $1,000"],
    coverageGaps: [],
  };

  it("accepts a reply that only uses the computed numbers", () => {
    expect(findUngroundedRenewalNumbers(grounded, input)).toEqual([]);
    expect(renewalExplanationFromResponse(JSON.stringify(grounded), input).source).toBe("claude");
  });

  it("falls back to the template when Claude invents a saving", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const invented = { ...grounded, mitigation: ["Ember-resistant vents could save you $450 a year"] };
    expect(findUngroundedRenewalNumbers(invented, input)).toEqual([450]);
    expect(renewalExplanationFromResponse(JSON.stringify(invented), input).source).toBe("template");
    warn.mockRestore();
  });

  it("falls back on malformed JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(renewalExplanationFromResponse("not json at all", input).source).toBe("template");
    warn.mockRestore();
  });
});

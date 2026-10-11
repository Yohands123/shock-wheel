import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_HOUSE, simulateRenewals } from "@shock/shared";
import { gql, prisma, resetDb } from "./helpers";

const SAVE = /* GraphQL */ `
  mutation Save($input: HouseInput!) {
    saveHouse(input: $input) { id label pathSeed year profile { currentAnnualPremium roofAgeYears } coverageGaps { endorsement } exposure { peril score } }
  }`;

const SPIN = /* GraphQL */ `
  mutation Spin($houseId: ID!, $seed: String) {
    spinRenewal(houseId: $houseId, seed: $seed) {
      id year seed sliceIndex severityLabel premiumBefore premiumAfter changePct
      event { id shortLabel lowersPremium }
      drivers { label amount }
      nonRenewalRisk disclaimer
      explanation { headline whyItMoved askYourBroker mitigation source }
    }
  }`;

const PATH = /* GraphQL */ `query Path($houseId: ID!) { renewalPath(houseId: $houseId) { year seed premiumAfter event { id } } }`;

const houseInput = (over: Record<string, unknown> = {}) => ({ ...DEFAULT_HOUSE, pathSeed: "replay-path", ...over });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function newHouse(over: Record<string, unknown> = {}) {
  const res = await gql(SAVE, { input: houseInput(over) });
  expect(res.errors).toBeUndefined();
  return res.data.saveHouse as { id: string; pathSeed: string };
}

describe("saveHouse", () => {
  it("creates a house with exposure and coverage gaps computed from the profile", async () => {
    const res = await gql(SAVE, { input: houseInput({ region: "TEXAS_GULF", distanceToWater: "UNDER_500M", endorsements: [] }) });
    expect(res.errors).toBeUndefined();
    const h = res.data.saveHouse;
    expect(h.year).toBe(0);
    expect(h.exposure).toHaveLength(7);
    expect(h.coverageGaps.map((g: any) => g.endorsement)).toContain("OVERLAND_FLOOD");
  });

  it("rejects an invalid profile with a readable message", async () => {
    const res = await gql(SAVE, { input: houseInput({ claimsLast5Years: 9 }) });
    expect(res.errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
    expect(res.errors?.[0].message).toContain("claimsLast5Years");
    const region = await gql(SAVE, { input: houseInput({ region: "ATLANTIS" }) });
    expect(region.errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
  });
});

describe("spinRenewal", () => {
  it("advances one year at a time, chaining premiums, and writes a SPIN_RENEWAL audit row", async () => {
    const { id } = await newHouse();
    const y1 = (await gql(SPIN, { houseId: id })).data.spinRenewal;
    const y2 = (await gql(SPIN, { houseId: id })).data.spinRenewal;
    expect([y1.year, y2.year]).toEqual([1, 2]);
    expect(y1.premiumBefore).toBe(DEFAULT_HOUSE.currentAnnualPremium);
    expect(y2.premiumBefore).toBe(y1.premiumAfter);
    expect(y1.seed).toBe("replay-path:1");
    expect(y1.disclaimer).toContain("not a quote");
    expect(y1.explanation.source).toBe("template"); // tests never call Claude

    const sum = y1.drivers.reduce((t: number, d: { amount: number }) => t + d.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(Math.round((y1.premiumAfter - y1.premiumBefore) * 100) / 100);

    const audit = await prisma.auditLog.findMany({ where: { action: "SPIN_RENEWAL" }, orderBy: { id: "asc" } });
    expect(audit).toHaveLength(2);
    expect((audit[0].payload as any)).toMatchObject({ houseId: id, year: 1, seed: "replay-path:1" });

    const house = await gql(`query($id: ID!) { house(id: $id) { year profile { currentAnnualPremium } } }`, { id });
    expect(house.data.house).toEqual({ year: 2, profile: { currentAnnualPremium: y2.premiumAfter } });
  });

  it("reproduces the whole path for the same path seed, matching the shared engine", async () => {
    const a = await newHouse();
    const b = await newHouse();
    for (let i = 0; i < 5; i++) {
      await gql(SPIN, { houseId: a.id });
      await gql(SPIN, { houseId: b.id });
    }
    const pa = (await gql(PATH, { houseId: a.id })).data.renewalPath;
    const pb = (await gql(PATH, { houseId: b.id })).data.renewalPath;
    const strip = (p: any[]) => p.map(({ year, seed, premiumAfter, event }) => ({ year, seed, premiumAfter, event: event.id }));
    expect(strip(pa)).toEqual(strip(pb));

    const engine = simulateRenewals(DEFAULT_HOUSE, "replay-path", 5);
    expect(pa.map((r: any) => r.event.id)).toEqual(engine.map((s) => s.event.id));
    expect(pa.map((r: any) => r.premiumAfter)).toEqual(engine.map((s) => s.result.newPremium));
  });

  it("uses an explicit seed when one is passed", async () => {
    const { id } = await newHouse();
    const run = (await gql(SPIN, { houseId: id, seed: "my-own-seed" })).data.spinRenewal;
    expect(run.seed).toBe("my-own-seed");
    const engine = simulateRenewals(DEFAULT_HOUSE, "unused", 1);
    expect(engine).toHaveLength(1);
  });

  it("returns NOT_FOUND for an unknown house and rejects unknown actors", async () => {
    expect((await gql(SPIN, { houseId: "nope" })).errors?.[0].extensions?.code).toBe("NOT_FOUND");
    const { id } = await newHouse();
    expect((await gql(SPIN, { houseId: id }, "intruder")).errors?.[0].extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("only one of two concurrent spins prices a given year", async () => {
    const { id } = await newHouse();
    const results = await Promise.all([gql(SPIN, { houseId: id }), gql(SPIN, { houseId: id })]);
    const ok = results.filter((r) => !r.errors);
    expect(ok).toHaveLength(1);
    expect(results.find((r) => r.errors)?.errors?.[0].extensions?.code).toBe("CONFLICT");
    expect(await prisma.renewalRun.count({ where: { houseId: id } })).toBe(1);
  });
});

describe("resetHouse and editing", () => {
  it("start over restores the saved profile, clears the path and picks a new path seed", async () => {
    const { id, pathSeed } = await newHouse({ roofAgeYears: 4 });
    await gql(SPIN, { houseId: id });
    await gql(SPIN, { houseId: id });
    const res = await gql(`mutation($id: ID!) { resetHouse(houseId: $id) { year pathSeed profile { roofAgeYears currentAnnualPremium } } }`, { id });
    expect(res.data.resetHouse.year).toBe(0);
    expect(res.data.resetHouse.profile).toEqual({ roofAgeYears: 4, currentAnnualPremium: DEFAULT_HOUSE.currentAnnualPremium });
    expect(res.data.resetHouse.pathSeed).not.toBe(pathSeed);
  });

  it("saving an existing house restarts its path on the new profile", async () => {
    const { id } = await newHouse();
    await gql(SPIN, { houseId: id });
    const res = await gql(SAVE, { input: houseInput({ id, currentAnnualPremium: 3100 }) });
    expect(res.data.saveHouse).toMatchObject({ id, year: 0, profile: { currentAnnualPremium: 3100 } });
  });
});

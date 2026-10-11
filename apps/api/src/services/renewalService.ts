import { Prisma, type PrismaClient, type House as HouseRow } from "@prisma/client";
import { GraphQLError } from "graphql";
import { z } from "zod";
import { ENDORSEMENTS, randomSeed, REGIONS, renewalSpin, yearSeed, type HouseProfile } from "@shock/shared";
import { explainRenewal } from "./renewalExplainer";

const fail = (message: string, code: string) => new GraphQLError(message, { extensions: { code } });

export const HouseProfileSchema = z.object({
  label: z.string().trim().min(1, "Give the house a name").max(60),
  region: z.enum(REGIONS.map((r) => r.id) as [HouseProfile["region"], ...HouseProfile["region"][]]),
  areaNote: z.string().trim().max(200).default(""),
  replacementCost: z.number().min(50_000).max(20_000_000),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 1),
  roofAgeYears: z.number().int().min(0).max(80),
  construction: z.enum(["WOOD_FRAME", "MASONRY", "CONCRETE"]),
  distanceToWater: z.enum(["UNDER_500M", "500M_TO_2KM", "OVER_2KM"]),
  wildlandInterface: z.boolean(),
  claimsLast5Years: z.number().int().min(0).max(5),
  deductible: z.number().min(0).max(100_000),
  currentAnnualPremium: z.number().min(100).max(200_000),
  endorsements: z.array(z.enum(ENDORSEMENTS as [HouseProfile["endorsements"][number], ...HouseProfile["endorsements"]])).default([]),
});

export const asProfile = (json: Prisma.JsonValue) => json as unknown as HouseProfile;
const toJson = (p: HouseProfile) => p as unknown as Prisma.InputJsonValue;

function parseProfile(input: unknown): HouseProfile {
  const parsed = HouseProfileSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw fail(`${first.path.join(".") || "house"}: ${first.message}`, "BAD_USER_INPUT");
  }
  return { ...parsed.data, endorsements: [...new Set(parsed.data.endorsements)] };
}

async function loadHouse(prisma: PrismaClient, id: string) {
  const house = await prisma.house.findUnique({ where: { id } });
  if (!house) throw fail(`House ${id} not found`, "NOT_FOUND");
  return house;
}

/**
 * Create a house, or update one. Updating the profile restarts the path, because
 * earlier renewal years were priced on the old profile.
 */
export async function saveHouse(
  prisma: PrismaClient,
  actorId: string,
  input: { id?: string | null; pathSeed?: string | null } & Record<string, unknown>,
): Promise<HouseRow> {
  const { id, pathSeed, ...rest } = input;
  const profile = parseProfile(rest);
  if (id) {
    await loadHouse(prisma, id);
    return prisma.$transaction(async (tx) => {
      await tx.renewalRun.deleteMany({ where: { houseId: id } });
      return tx.house.update({
        where: { id },
        data: { label: profile.label, initialProfile: toJson(profile), profile: toJson(profile), ...(pathSeed ? { pathSeed } : {}) },
      });
    });
  }
  return prisma.house.create({
    data: { label: profile.label, initialProfile: toJson(profile), profile: toJson(profile), pathSeed: pathSeed || randomSeed(), createdById: actorId },
  });
}

/**
 * Advance one renewal year. The server decides the event from the seed: by default
 * "<pathSeed>:<year>", so the house's path seed replays every year exactly.
 */
export async function spinRenewal(prisma: PrismaClient, actorId: string, houseId: string, seed?: string | null) {
  const house = await loadHouse(prisma, houseId);
  const last = await prisma.renewalRun.findFirst({ where: { houseId }, orderBy: { year: "desc" }, select: { year: true } });
  const year = (last?.year ?? 0) + 1;
  const runSeed = seed?.trim() || yearSeed(house.pathSeed, year);
  const profile = asProfile(house.profile);
  const spin = renewalSpin(profile, runSeed);
  const r = spin.result;

  const explanation = await explainRenewal({
    year,
    event: spin.event,
    severityLabel: spin.severityLabel,
    severity: spin.severity,
    profile,
    exposure: r.exposure,
    premiumBefore: r.previousPremium,
    premiumAfter: r.newPremium,
    changePct: r.changePct,
    drivers: r.drivers,
    nonRenewalRisk: r.nonRenewalRisk,
    coverageGaps: r.coverageGaps,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const run = await tx.renewalRun.create({
        data: {
          houseId,
          year,
          seed: runSeed,
          eventId: spin.event.id,
          severityLabel: spin.severityLabel,
          severity: spin.severity,
          sliceIndex: spin.sliceIndex,
          premiumBefore: r.previousPremium,
          premiumAfter: r.newPremium,
          changePct: r.changePct,
          drivers: r.drivers as unknown as Prisma.InputJsonValue,
          nonRenewalRisk: r.nonRenewalRisk,
          coverageGaps: r.coverageGaps as unknown as Prisma.InputJsonValue,
          explanation: explanation as unknown as Prisma.InputJsonValue,
          createdById: actorId,
        },
      });
      // Conditional on the profile we priced from, so two spins at once can't both advance the house
      const { count } = await tx.house.updateMany({
        where: { id: houseId, updatedAt: house.updatedAt },
        data: { profile: toJson(r.updatedProfile) },
      });
      if (count === 0) throw fail("This house changed while the wheel was spinning; refresh and spin again", "CONFLICT");
      await tx.auditLog.create({
        data: {
          action: "SPIN_RENEWAL",
          actorId,
          payload: { houseId, runId: run.id, year, seed: runSeed, eventId: spin.event.id, severity: spin.severityLabel, premiumBefore: r.previousPremium, premiumAfter: r.newPremium },
        },
      });
      return run;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw fail("Another spin already priced this renewal year; refresh to see it", "CONFLICT");
    }
    throw err;
  }
}

/** Back to the saved profile with a fresh path seed; the renewal history is cleared. */
export async function resetHouse(prisma: PrismaClient, houseId: string) {
  const house = await loadHouse(prisma, houseId);
  return prisma.$transaction(async (tx) => {
    await tx.renewalRun.deleteMany({ where: { houseId } });
    return tx.house.update({ where: { id: houseId }, data: { profile: house.initialProfile as Prisma.InputJsonValue, pathSeed: randomSeed() } });
  });
}

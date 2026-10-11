import type { House as HouseRow, RenewalRun as RunRow } from "@prisma/client";
import { GraphQLError } from "graphql";
import {
  coverageGaps,
  exposure,
  PERIL_LABEL,
  PERILS,
  regionById,
  REGIONS,
  RENEWAL_EVENTS,
  renewalEventById,
  type PerilScores,
  type Region,
} from "@shock/shared";
import type { Context } from "./context";
import { num } from "./db";
import { asProfile, resetHouse, saveHouse, spinRenewal } from "./services/renewalService";

export const RENEWAL_DISCLAIMER = "Illustrative model, not a quote. Real premiums depend on your insurer's rating and policy wording.";

const iso = (d: Date) => d.toISOString();
const scores = (s: PerilScores) => PERILS.map((p) => ({ peril: p, label: PERIL_LABEL[p], score: s[p] }));

async function requireActor(ctx: Context) {
  const user = await ctx.prisma.user.findUnique({ where: { id: ctx.actorId } });
  if (!user) throw new GraphQLError("Unknown user", { extensions: { code: "UNAUTHENTICATED" } });
  return user;
}

export const renewalResolvers = {
  Query: {
    regions: () => REGIONS,
    renewalEvents: () => RENEWAL_EVENTS,
    houses: (_: unknown, __: unknown, ctx: Context) => ctx.prisma.house.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
    house: (_: unknown, { id }: { id: string }, ctx: Context) => ctx.prisma.house.findUnique({ where: { id } }),
    renewalPath: (_: unknown, { houseId }: { houseId: string }, ctx: Context) =>
      ctx.prisma.renewalRun.findMany({ where: { houseId }, orderBy: { year: "asc" } }),
  },

  Mutation: {
    saveHouse: async (_: unknown, { input }: { input: Record<string, unknown> & { id?: string; pathSeed?: string } }, ctx: Context) => {
      await requireActor(ctx);
      return saveHouse(ctx.prisma, ctx.actorId, input);
    },
    spinRenewal: async (_: unknown, a: { houseId: string; seed?: string }, ctx: Context) => {
      await requireActor(ctx);
      return spinRenewal(ctx.prisma, ctx.actorId, a.houseId, a.seed);
    },
    resetHouse: async (_: unknown, { houseId }: { houseId: string }, ctx: Context) => {
      await requireActor(ctx);
      return resetHouse(ctx.prisma, houseId);
    },
  },

  Region: {
    hazards: (r: Region) => scores(r.hazards),
  },

  House: {
    profile: (h: HouseRow) => asProfile(h.profile),
    initialProfile: (h: HouseRow) => asProfile(h.initialProfile),
    year: (h: HouseRow, _: unknown, ctx: Context) => ctx.prisma.renewalRun.count({ where: { houseId: h.id } }),
    region: (h: HouseRow) => regionById(asProfile(h.profile).region),
    exposure: (h: HouseRow) => scores(exposure(asProfile(h.profile))),
    coverageGaps: (h: HouseRow) => coverageGaps(asProfile(h.profile)),
    runs: (h: HouseRow, _: unknown, ctx: Context) => ctx.prisma.renewalRun.findMany({ where: { houseId: h.id }, orderBy: { year: "asc" } }),
    createdAt: (h: HouseRow) => iso(h.createdAt),
  },

  RenewalRun: {
    event: (r: RunRow) => renewalEventById(r.eventId),
    premiumBefore: (r: RunRow) => num(r.premiumBefore),
    premiumAfter: (r: RunRow) => num(r.premiumAfter),
    disclaimer: () => RENEWAL_DISCLAIMER,
    createdAt: (r: RunRow) => iso(r.createdAt),
  },
};

import { PrismaClient } from "@prisma/client";
import { createServer } from "../src/server";
import { seedDatabase } from "../src/seedData";

export const prisma = new PrismaClient();
export const server = createServer();

export async function resetDb() {
  await seedDatabase(prisma);
}

/** Execute an operation against the real schema + real Postgres, no HTTP. */
export async function gql<T = any>(query: string, variables?: Record<string, unknown>, actorId = "u-maya") {
  const res = await server.executeOperation({ query, variables }, { contextValue: { prisma, actorId } });
  if (res.body.kind !== "single") throw new Error("Expected a single result");
  return res.body.singleResult as { data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }> };
}

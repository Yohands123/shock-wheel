import type { PrismaClient } from "@prisma/client";

export interface Context {
  prisma: PrismaClient;
  /** Demo auth: the web app sends x-user-id. Swap for real auth later. */
  actorId: string;
}

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export const num = (d: unknown): number => Number(d);

import { prisma } from "../db";
import { runMarginSweep } from "./marginSweep";

runMarginSweep(prisma, { tick: process.argv.includes("--tick") })
  .then((r) => console.log(r))
  .finally(() => prisma.$disconnect());

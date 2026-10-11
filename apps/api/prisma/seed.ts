import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/seedData";

const prisma = new PrismaClient();
seedDatabase(prisma)
  .then(() => console.log("Seeded users, price feed, and 16 accounts"))
  .finally(() => prisma.$disconnect());

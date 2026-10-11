import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Local runs read env from apps/api/.env; CI sets it in the environment.
// loadEnvFile never overrides variables that are already set.
if (existsSync(".env")) process.loadEnvFile(".env");

// Point globalSetup and every Prisma client at the test database. Worker
// processes inherit this env, so they never touch the dev database.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Tests never call Claude: the explainer uses its template, and parsing/grounding is unit-tested directly
process.env.ANTHROPIC_API_KEY = "";

export default defineConfig({
  test: {
    globalSetup: ["./test/globalSetup.ts"],
    // Integration tests share one database, so run files serially
    fileParallelism: false,
    testTimeout: 20_000,
  },
});

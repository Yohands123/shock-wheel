import { defineConfig } from "vitest/config";

export default defineConfig({
  // Playwright owns e2e/; Vitest runs the unit tests in src/
  test: { include: ["src/**/*.test.ts"] },
});

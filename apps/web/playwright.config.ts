import { defineConfig } from "@playwright/test";

const CI = !!process.env.CI;

/**
 * End-to-end accessibility check. Needs Postgres with seeded data; starts the API and
 * the web dev server unless they're already running locally.
 * Locally it uses your installed Chrome (PW_CHANNEL=chrome); CI installs Playwright's Chromium.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    channel: process.env.PW_CHANNEL || undefined,
    // Reduced motion: the wheel jumps to the server's result, which also exercises that path
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @shock/api start",
      url: "http://localhost:4000/.well-known/apollo/server-health",
      reuseExistingServer: !CI,
      timeout: 60_000,
      env: { DISABLE_SCHEDULER: "1", ANTHROPIC_API_KEY: "" },
    },
    {
      command: "pnpm --filter @shock/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
  ],
});

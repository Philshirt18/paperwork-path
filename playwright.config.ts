// Smoke test: the judge's path through the app, in a real browser.
// Uses your installed Chrome (no browser download). Starts the dev server,
// or reuses one already running on port 3000.
//   npm run test:e2e
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts", // not *.test.ts, so Vitest leaves these alone
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    channel: process.env.PW_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

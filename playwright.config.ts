import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: process.env.METRO_VIEW_E2E_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "on-first-retry",
    timezoneId: "UTC",
    ...devices["Desktop Chrome"],
  },
});

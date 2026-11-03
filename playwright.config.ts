import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  use: { baseURL: "http://127.0.0.1:5180", trace: "retain-on-failure" },
  globalSetup: "./e2e/server.setup.ts",
  metadata: { pilotServerMode: "development" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});

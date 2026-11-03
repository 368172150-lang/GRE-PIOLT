import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./e2e",
  testMatch: "release.spec.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:4173" },
  metadata: { pilotServerMode: "preview" },
});

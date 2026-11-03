import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import hosting from "./vercel.json";
export default defineConfig({
  plugins: [react()],
  preview: {
    headers: Object.fromEntries(
      hosting.headers[0].headers.map((h) => [h.key, h.value]),
    ),
  },
  test: {
    sequence: { concurrent: false },
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

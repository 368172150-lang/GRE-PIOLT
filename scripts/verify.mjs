/* global console */
import { execFileSync } from "node:child_process";
import process from "node:process";
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run through npm run check or npm run verify.");
const steps = [
  "lint",
  "typecheck",
  "content:check",
  "test",
  "build",
  ...(process.argv.includes("--browser")
    ? ["test:e2e", "test:production"]
    : []),
];
for (const step of steps) {
  console.log(`\nGRE Pilot verification: ${step}`);
  try {
    execFileSync(process.execPath, [npm, "run", step], { stdio: "inherit" });
  } catch (e) {
    process.exit(e.status ?? 1);
  }
}
console.log("\nAll requested checks passed.");

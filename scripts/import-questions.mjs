/* global console */
import fs from "node:fs";
import process from "node:process";
import { Buffer } from "node:buffer";
import path from "node:path";
import { randomUUID } from "node:crypto";
// Staging only: importing never approves content or changes the live question bank.
const input = process.argv[2];
if (!input) throw new Error("Usage: npm run questions:import -- input.json");
const text = fs.readFileSync(input, "utf8");
if (Buffer.byteLength(text) > 2000000) throw new Error("Input exceeds 2 MB");
const rows = JSON.parse(text);
if (!Array.isArray(rows) || rows.length < 1 || rows.length > 200)
  throw new Error("Provide an array of 1–200 questions");
for (const row of rows)
  if (
    !row ||
    typeof row.prompt !== "string" ||
    !Array.isArray(row.options) ||
    !row.solution
  )
    throw new Error("Each question requires prompt, options and solution");
const staged = rows.map((row) => ({
  ...row,
  id: row.id || randomUUID(),
  revision: row.revision || 1,
  source: row.source || "user-import:unreviewed",
  ai_assisted: row.ai_assisted ?? true,
  review_status: "draft",
}));
fs.mkdirSync("work", { recursive: true });
const output = path.resolve("work/question-import-draft.json");
fs.writeFileSync(output, JSON.stringify(staged, null, 2) + "\n");
console.log(
  `Staged ${staged.length} DRAFT questions at ${output}. Review content and schema before adding to the source bank. Nothing was published.`,
);

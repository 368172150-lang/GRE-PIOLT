/* global console */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
const root = process.cwd();
fs.mkdirSync("work", { recursive: true });
const temporary = fs.mkdtempSync(path.join(root, "work", "content-check-"));
for (const dir of ["src/data", "supabase", "public"])
  fs.mkdirSync(path.join(temporary, dir), { recursive: true });
for (const file of ["vocabulary.json", "questions.json", "writing.json"])
  fs.copyFileSync(
    path.join(root, "src/data", file),
    path.join(temporary, "src/data", file),
  );
for (const generator of [
  "generate-vocabulary.mjs",
  "generate-questions.mjs",
  "generate-writing.mjs",
])
  execFileSync(process.execPath, [path.join(root, "scripts", generator)], {
    cwd: temporary,
    stdio: "pipe",
  });
const files = [
  "supabase/seed.sql",
  "supabase/questions-seed.sql",
  "supabase/writing-seed.sql",
  "public/vocabulary-template.csv",
];
for (const file of files) {
  const normalize = (s) => s.replaceAll("\r\n", "\n");
  if (
    normalize(fs.readFileSync(path.join(root, file), "utf8")) !==
    normalize(fs.readFileSync(path.join(temporary, file), "utf8"))
  )
    throw new Error(`Generated content is stale: ${file}`);
}
console.log(
  "All 4 generated content artifacts match the original source banks.",
);

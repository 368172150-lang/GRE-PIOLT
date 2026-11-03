/* global console */
import fs from "node:fs";
const prompts = JSON.parse(fs.readFileSync("src/data/writing.json", "utf8"));
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
if (
  !Array.isArray(prompts) ||
  new Set(prompts.map((p) => p.id)).size !== prompts.length ||
  prompts.some(
    (p) =>
      !p.id ||
      !p.title ||
      !p.prompt ||
      !p.source ||
      !["draft", "reviewed"].includes(p.review_status),
  )
)
  throw new Error("Invalid writing prompt bank");
fs.writeFileSync(
  "supabase/writing-seed.sql",
  "-- Original AI-assisted, author-reviewed Issue prompts. No user activity.\ninsert into public.writing_prompts(id,title,prompt,source,review_status) values\n" +
    prompts
      .map(
        (p) =>
          "(" +
          [p.id, p.title, p.prompt, p.source, p.review_status]
            .map(quote)
            .join(",") +
          ")",
      )
      .join(",\n") +
    "\non conflict(id) do update set title=excluded.title,prompt=excluded.prompt,source=excluded.source,review_status=excluded.review_status;\n",
);
console.log(`Generated ${prompts.length} writing prompts.`);

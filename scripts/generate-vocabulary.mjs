/* global console */
import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync("src/data/vocabulary.json", "utf8"));
if (
  new Set(rows.map((row) => row.id)).size !== rows.length ||
  new Set(rows.map((row) => row.word.toLowerCase())).size !== rows.length
)
  throw new Error("Duplicate vocabulary ID or spelling");
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const entries = rows.map(({ id, ...content }) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new Error("Missing stable vocabulary UUID");
  return (
    "(" +
    [
      quote(id),
      quote(content.word),
      quote(JSON.stringify(content)) + "::jsonb",
      quote("original:GRE-Pilot-v0.3"),
      quote("reviewed"),
    ].join(",") +
    ")"
  );
});
fs.writeFileSync(
  "supabase/seed.sql",
  "-- Original definitions and examples authored for GRE Pilot; no user activity or commercial questions.\n-- Apply after migrations 001, 002 and 003. Stable content UUIDs survive reordering and additions.\nbegin;\ninsert into public.vocabulary(id,word,content,source,review_status) values\n" +
    entries.join(",\n") +
    "\non conflict(id) do update set word=excluded.word,content=excluded.content,source=excluded.source,review_status=excluded.review_status;\ncommit;\n",
);
fs.mkdirSync("public", { recursive: true });
const csv = (value) =>
  '"' +
  String(Array.isArray(value) ? value.join("|") : value).replaceAll('"', '""') +
  '"';
const columns = [
  "word",
  "ipa",
  "part_of_speech",
  "definition_en",
  "definition_zh",
  "example_en",
  "example_zh",
  "synonyms",
  "antonyms",
  "difficulty",
  "tags",
];
const sample = [
  "lucid",
  "/ˈluːsɪd/",
  "adjective",
  "Easy to follow because it is expressed clearly.",
  "清晰易懂的",
  "Her lucid explanation helped the group understand the proof.",
  "她清晰的讲解帮助小组理解了证明。",
  ["clear"],
  ["confusing"],
  2,
  ["communication"],
];
fs.writeFileSync(
  "public/vocabulary-template.csv",
  "\uFEFF" +
    [columns, sample].map((row) => row.map(csv).join(",")).join("\r\n") +
    "\r\n",
);
console.log(
  "Generated " + rows.length + " public vocabulary rows and CSV template.",
);

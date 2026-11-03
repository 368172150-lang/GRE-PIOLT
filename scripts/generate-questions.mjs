/* global console */
import fs from "node:fs";
const bank = JSON.parse(fs.readFileSync("src/data/questions.json", "utf8"));
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
if (new Set(bank.map((q) => q.id)).size !== bank.length)
  throw new Error("Duplicate question UUID");
let sql =
  "-- Original AI-assisted sample questions, author-checked and covered by grading/content tests.\n-- Apply after migrations 001–004. No user activity is seeded.\nbegin;\n";
for (const { solution, ...question } of bank) {
  const { options, ...publicQuestion } = question;
  sql += `insert into public.questions(id,module,question_type,difficulty,prompt,source,review_status,content) values(${quote(question.id)},${quote(question.module)},${quote(question.type)},${question.difficulty},${quote(question.prompt)},${quote(question.source)},${quote(question.review_status)},${quote(JSON.stringify(publicQuestion))}::jsonb) on conflict(id) do update set module=excluded.module,question_type=excluded.question_type,difficulty=excluded.difficulty,prompt=excluded.prompt,source=excluded.source,review_status=excluded.review_status,content=excluded.content;\n`;
  sql += `delete from public.question_options where question_id=${quote(question.id)};\n`;
  for (const option of options)
    sql += `insert into public.question_options(question_id,option_key,content,blank_index) values(${quote(question.id)},${quote(option.key)},${quote(option.text)},${option.blank_index === null ? "null" : option.blank_index});\n`;
  sql += `insert into public.question_solutions(question_id,solution) values(${quote(question.id)},${quote(JSON.stringify(solution))}::jsonb) on conflict(question_id) do update set solution=excluded.solution;\n`;
}
fs.writeFileSync("supabase/questions-seed.sql", sql + "commit;\n");
console.log(
  `Generated ${bank.length} original questions and separate grading data.`,
);

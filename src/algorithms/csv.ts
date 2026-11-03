import { wordContentSchema, type WordContent } from "../types/vocabulary";
export const csvColumns = [
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
] as const;
/** Quoted fields, escaped quotes, CRLF and embedded newlines; rejects ambiguous malformed CSV. */
export function parseCsv(text: string): string[][] {
  if (new TextEncoder().encode(text).length > 500000)
    throw new Error("CSV_TOO_LARGE");
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(field);
    field = "";
    closed = false;
  };
  const line = () => {
    cell();
    if (row.some((v) => v.trim() !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      if (field !== "" || closed) throw new Error("CSV_QUOTES");
      quoted = true;
    } else if (ch === ",") cell();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      line();
    } else {
      if (closed) {
        if (ch === " " || ch === "\t") continue;
        throw new Error("CSV_QUOTES");
      }
      field += ch;
    }
  }
  if (quoted) throw new Error("CSV_QUOTES");
  if (field !== "" || row.length || closed) line();
  if (rows.length > 201) throw new Error("CSV_ROW_LIMIT");
  return rows;
}
export function importCsv(text: string): WordContent[] {
  const [header, ...rows] = parseCsv(text);
  if (!header || !rows.length) throw new Error("CSV_EMPTY");
  const names = header.map((h) => h.trim());
  if (
    new Set(names).size !== names.length ||
    csvColumns.some((name) => !names.includes(name))
  )
    throw new Error("CSV_HEADERS");
  return rows.map((values, index) => {
    if (values.length !== names.length)
      throw new Error(`CSV_ROW ${index + 2}: columns`);
    const row = Object.fromEntries(
      names.map((name, i) => [name, values[i].trim()]),
    );
    const parsed = wordContentSchema.safeParse({
      ...row,
      difficulty: Number(row.difficulty),
      synonyms: row.synonyms
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean),
      antonyms: row.antonyms
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean),
      tags: row.tags
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean),
    });
    if (!parsed.success)
      throw new Error(
        `CSV_ROW ${index + 2}: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
      );
    return parsed.data;
  });
}

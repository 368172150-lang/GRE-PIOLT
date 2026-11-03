import rows from "./vocabulary.json";
import { wordSchema, type Word } from "../types/vocabulary";
// Explicit content UUIDs remain stable when entries are reordered or new words are inserted.
export const originalWords: Word[] = rows.map((row) =>
  wordSchema.parse({
    ...row,
    source: "original:GRE-Pilot-v0.3",
    owner_id: null,
    review_status: "reviewed",
  }),
);

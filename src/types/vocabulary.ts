import { z } from "../lib/validation";
const text = z.string().trim().min(1).max(1500);
export const wordContentSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z]+(?:[- '][A-Za-z]+)*$/),
  ipa: z.string().trim().max(100),
  part_of_speech: text,
  definition_en: text,
  definition_zh: text,
  example_en: text,
  example_zh: text,
  synonyms: z.array(text).max(20),
  antonyms: z.array(text).max(20),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(text).max(20),
});
export type WordContent = z.infer<typeof wordContentSchema>;
export const wordSchema = wordContentSchema.extend({
  id: z.string().uuid(),
  source: z.string(),
  owner_id: z.string().uuid().nullable(),
  review_status: z.literal("reviewed"),
});
export type Word = z.infer<typeof wordSchema>;
export const progressSchema = z.object({
  vocabulary_id: z.string().uuid(),
  repetitions: z.number().int().nonnegative(),
  interval_days: z.number().int().nonnegative(),
  ease_factor: z.number().min(1.3),
  due_date: z.string().date().nullable(),
  status: z.enum(["new", "learning", "review", "mastered"]),
  favorite: z.boolean(),
  last_reviewed_at: z.string().nullable(),
  revision: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
});
export type WordProgress = z.infer<typeof progressSchema>;
export const reviewEventSchema = z.object({
  id: z.string().uuid(),
  vocabulary_id: z.string().uuid(),
  local_date: z.string().date(),
  mode: z.enum(["card", "spelling", "choice"]),
  answer: z.string(),
  quality: z.number().int().min(0).max(5),
  correct: z.boolean(),
  kind: z.enum(["new", "review", "extra"]),
  scheduled: z.boolean(),
  created_at: z.string(),
  input: z.unknown(),
});
export type ReviewEvent = z.infer<typeof reviewEventSchema>;
export const vocabStateSchema = z.object({
  custom: z.array(wordSchema),
  progress: z.array(progressSchema),
  reviews: z.array(reviewEventSchema),
});
export type VocabState = z.infer<typeof vocabStateSchema>;
export const vocabSnapshotSchema = z.object({
  new_word_target: z.number().int().positive(),
  today: z.string().date(),
  words: z.array(wordSchema),
  progress: z.array(progressSchema),
  reviews: z.array(reviewEventSchema),
  imported: z.number().int().nonnegative(),
});
export type VocabSnapshot = z.infer<typeof vocabSnapshotSchema>;
export type VocabAction =
  | { kind: "ensure" }
  | { kind: "favorite"; wordId: string; value: boolean }
  | { kind: "import"; words: WordContent[]; reviewed: true }
  | {
      kind: "review";
      date: string;
      id: string;
      wordId: string;
      revision: number;
      mode: "card" | "spelling" | "choice";
      answer: string;
      quality?: number;
    };
export function emptyVocab(): VocabState {
  return { custom: [], progress: [], reviews: [] };
}
export function initialProgress(id: string): WordProgress {
  return {
    vocabulary_id: id,
    repetitions: 0,
    interval_days: 0,
    ease_factor: 2.5,
    due_date: null,
    status: "new",
    favorite: false,
    last_reviewed_at: null,
    revision: 0,
    lapses: 0,
  };
}

import { z } from "../lib/validation";
export const moduleSchema = z.enum(["verbal", "quant"]);
export const questionTypeSchema = z.enum([
  "text_completion",
  "sentence_equivalence",
  "reading_comprehension",
  "single_choice",
  "multiple_choice",
  "quantitative_comparison",
  "numeric_entry",
]);
export const optionSchema = z.object({
  key: z.string().min(1).max(8),
  text: z.string().min(1),
  blank_index: z.number().int().min(0).max(2).nullable(),
});
export const questionSchema = z.object({
  id: z.string().uuid(),
  module: moduleSchema,
  type: questionTypeSchema,
  category: z.string(),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()),
  format: z.enum(["single", "multiple", "blanks", "numeric", "comparison"]),
  selection_count: z.number().int().min(0).max(4),
  blank_count: z.number().int().min(0).max(3),
  prompt: z.string().min(1),
  passage: z.string().nullable(),
  quantity_a: z.string().nullable(),
  quantity_b: z.string().nullable(),
  options: z.array(optionSchema),
  source: z.string().min(1),
  ai_assisted: z.boolean(),
  review_status: z.literal("reviewed"),
  revision: z.number().int().positive(),
});
export type Question = z.infer<typeof questionSchema>;
export const answerSchema = z
  .object({
    choices: z.array(z.string()).max(10).optional(),
    blanks: z.array(z.string()).max(3).optional(),
    numeric: z.string().max(80).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length === 1, "ANSWER_FORMAT");
export type Answer = z.infer<typeof answerSchema>;
export const solutionSchema = z.object({
  answer: answerSchema,
  explanation_en: z.string().min(1),
  explanation_zh: z.string().min(1),
  steps_en: z.array(z.string()),
  steps_zh: z.array(z.string()),
  option_explanations: z.array(
    z.object({ key: z.string(), en: z.string(), zh: z.string() }),
  ),
  terms: z.array(
    z.object({ term: z.string(), en: z.string(), zh: z.string() }),
  ),
  sentence_analysis: z.object({ text: z.string(), zh: z.string() }).nullable(),
});
export type Solution = z.infer<typeof solutionSchema>;
export const sessionSchema = z.object({
  id: z.string().uuid(),
  module: moduleSchema,
  started_at: z.string(),
  ended_at: z.string().nullable(),
  local_date: z.string().date(),
  timezone: z.string(),
  question_ids: z.array(z.string().uuid()),
  deadline_at: z.string().nullable(),
  current_started_at: z.string(),
  start_input: z.unknown(),
});
export type PracticeSession = z.infer<typeof sessionSchema>;
export const attemptSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  question_id: z.string().uuid(),
  local_date: z.string().date(),
  answer: answerSchema,
  is_correct: z.boolean(),
  elapsed_seconds: z.number().int().nonnegative(),
  attempted_at: z.string(),
  question_revision: z.number().int(),
  question_snapshot: questionSchema,
  feedback: solutionSchema,
  request_input: z.unknown(),
});
export type Attempt = z.infer<typeof attemptSchema>;
export const mistakeSchema = z.object({
  id: z.string().uuid(),
  question_id: z.string().uuid(),
  wrong_answer: answerSchema,
  last_wrong_answer: answerSchema,
  frequency: z.number().int().positive(),
  reason: z.string().max(2000),
  mastered: z.boolean(),
  last_wrong_at: z.string(),
  first_attempt_id: z.string().uuid().nullable(),
  last_attempt_id: z.string().uuid().nullable(),
  reviewed_on: z.string().date().nullable(),
  revision: z.number().int().nonnegative(),
});
export type Mistake = z.infer<typeof mistakeSchema>;
export const bookmarkSchema = z.object({ question_id: z.string().uuid() });
export const practiceStateSchema = z.object({
  sessions: z.array(sessionSchema),
  attempts: z.array(attemptSchema),
  mistakes: z.array(mistakeSchema),
  bookmarks: z.array(bookmarkSchema),
});
export type PracticeState = z.infer<typeof practiceStateSchema>;
export const practiceSnapshotSchema = practiceStateSchema.extend({
  today: z.string().date(),
  server_now: z.string(),
  questions: z.array(questionSchema),
});
export type PracticeSnapshot = z.infer<typeof practiceSnapshotSchema>;
export const filterSchema = z
  .object({
    type: questionTypeSchema.optional(),
    category: z.string().max(60).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    tag: z.string().max(60).optional(),
    favorites: z.boolean().optional(),
    questionId: z.string().uuid().optional(),
  })
  .strict();
export type PracticeFilter = z.infer<typeof filterSchema>;
export type PracticeAction =
  | { kind: "ensure" }
  | {
      kind: "start";
      id: string;
      date: string;
      module: "verbal" | "quant";
      count: number;
      minutes: number | null;
      filter: PracticeFilter;
    }
  | {
      kind: "submit";
      id: string;
      date: string;
      sessionId: string;
      questionId: string;
      revision: number;
      answer: Answer;
    }
  | { kind: "end"; sessionId: string }
  | { kind: "favorite"; questionId: string; value: boolean }
  | {
      kind: "mistake";
      date: string;
      mistakeId: string;
      revision: number;
      reason: string;
      mastered: boolean;
    };
export function emptyPractice(): PracticeState {
  return { sessions: [], attempts: [], mistakes: [], bookmarks: [] };
}

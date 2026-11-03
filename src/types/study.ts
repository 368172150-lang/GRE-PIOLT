import { z } from "../lib/validation";
import { vocabStateSchema } from "./vocabulary";
import { practiceStateSchema } from "./practice";
import { writingStateSchema } from "./writing";
export const taskKeySchema = z.enum([
  "new_words",
  "review_words",
  "verbal",
  "quant",
  "mistakes",
  "focus",
]);
export type TaskKey = z.infer<typeof taskKeySchema>;
export const daySchema = z.object({
  id: z.string().uuid(),
  local_date: z.string().date(),
  timezone: z.string(),
  budget: z.number().int().positive(),
  notes: z.string(),
  created_at: z.string(),
});
export const taskSchema = z.object({
  id: z.string().uuid(),
  local_date: z.string().date(),
  task_key: taskKeySchema,
  target: z.number().int().positive(),
  estimated_minutes: z.number().nonnegative(),
  focus_type: z.string().nullable(),
  completed_at: z.string().nullable(),
  completion_source: z.enum(["manual", "automatic"]).nullable(),
});
export const eventSchema = z.object({
  id: z.string().uuid(),
  local_date: z.string().date(),
  minutes: z.number().int().min(1).max(180),
  note: z.string().max(2000),
  created_at: z.string(),
});
export const checkinSchema = z.object({
  id: z.string().uuid(),
  local_date: z.string().date(),
  timezone: z.string(),
  created_at: z.string(),
});
export const signalsSchema = z.object({
  dueReviews: z.number().int().nonnegative(),
  masteredWords: z.number().int().nonnegative(),
  verbal: z.object({
    attempts: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    weakType: z.string().nullable(),
  }),
  quant: z.object({
    attempts: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    weakType: z.string().nullable(),
  }),
});
export const snapshotSchema = z.object({
  writing: writingStateSchema.optional(),
  practice: practiceStateSchema.optional(),
  vocabulary: vocabStateSchema.optional(),
  today: z.string(),
  days: z.array(daySchema),
  tasks: z.array(taskSchema),
  events: z.array(eventSchema),
  checkins: z.array(checkinSchema),
  signals: signalsSchema,
});
export type StudyDay = z.infer<typeof daySchema>;
export type DailyTask = z.infer<typeof taskSchema>;
export type StudySnapshot = z.infer<typeof snapshotSchema>;
export type LearningSignals = z.infer<typeof signalsSchema>;
export type StudyAction =
  | { kind: "ensure" }
  | { kind: "replan"; date: string }
  | { kind: "toggle"; date: string; taskId: string; completed: boolean }
  | { kind: "note"; date: string; note: string }
  | { kind: "log"; date: string; id: string; minutes: number; note: string }
  | { kind: "checkin"; date: string };
export const emptySignals: LearningSignals = {
  dueReviews: 0,
  masteredWords: 0,
  verbal: { attempts: 0, correct: 0, weakType: null },
  quant: { attempts: 0, correct: 0, weakType: null },
};
export function emptySnapshot(): StudySnapshot {
  return {
    today: "",
    days: [],
    tasks: [],
    events: [],
    checkins: [],
    signals: structuredClone(emptySignals),
  };
}

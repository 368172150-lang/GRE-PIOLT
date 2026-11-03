import { z } from "../lib/validation";
export const feedbackSchema = z
  .object({
    structure: z.string().min(1).max(4000),
    logic: z.string().min(1).max(4000),
    language: z.string().min(1).max(4000),
    grammar: z.string().min(1).max(4000),
    revision: z.string().min(1).max(4000),
  })
  .strict();
export type WritingFeedback = z.infer<typeof feedbackSchema>;
export const writingDocumentSchema = z.object({
  id: z.string().uuid(),
  prompt_id: z.string(),
  prompt: z.string(),
  body: z.string().max(60000),
  notes: z.string().max(10000),
  started_at: z.string(),
  deadline_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
  local_date: z.string().date(),
  timezone: z.string(),
  revision: z.number().int().nonnegative(),
  last_input: z.unknown(),
  ai_feedback: feedbackSchema.nullable(),
});
export type WritingDocument = z.infer<typeof writingDocumentSchema>;
export const writingStateSchema = z.object({
  documents: z.array(writingDocumentSchema),
});
export const writingSnapshotSchema = writingStateSchema.extend({
  server_now: z.string(),
  today: z.string().date(),
});
export type WritingState = z.infer<typeof writingStateSchema>;
export type WritingSnapshot = z.infer<typeof writingSnapshotSchema>;
export type WritingAction =
  | { kind: "ensure" }
  | { kind: "start"; id: string; promptId: string }
  | {
      kind: "save" | "finish";
      id: string;
      requestId: string;
      revision: number;
      body: string;
      notes: string;
    };

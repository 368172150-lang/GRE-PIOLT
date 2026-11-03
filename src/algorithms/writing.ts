import {
  writingDocumentSchema,
  type WritingState,
  type WritingAction,
} from "../types/writing";
import { issuePrompts } from "../data/writing";
import { localDate } from "./dates";
export function wordCount(text: string) {
  // A visible, reproducible approximation: English letter/number tokens with internal apostrophes/hyphens.
  return text.match(/[A-Za-z0-9]+(?:['’−-][A-Za-z0-9]+)*/g)?.length ?? 0;
}
export function writingTransition(
  input: WritingState,
  action: WritingAction,
  timezone: string,
  now: Date,
): WritingState {
  const state = structuredClone(input),
    stamp = now.toISOString();
  if (action.kind === "ensure") return state;
  const row = state.documents.find((d) => d.id === action.id);
  if (action.kind === "start") {
    const prompt = issuePrompts.find((p) => p.id === action.promptId);
    if (!prompt) throw new Error("INVALID_PROMPT");
    if (row) {
      if (row.prompt_id !== action.promptId)
        throw new Error("IDEMPOTENCY_CONFLICT");
      return state;
    }
    state.documents.push(
      writingDocumentSchema.parse({
        id: action.id,
        prompt_id: prompt.id,
        prompt: prompt.prompt,
        body: "",
        notes: "",
        started_at: stamp,
        deadline_at: new Date(now.getTime() + 1800000).toISOString(),
        created_at: stamp,
        updated_at: stamp,
        completed_at: null,
        local_date: localDate(now, timezone),
        timezone,
        revision: 0,
        last_input: null,
        ai_feedback: null,
      }),
    );
    return state;
  }
  if (!row) throw new Error("DOCUMENT_NOT_FOUND");
  if (JSON.stringify(row.last_input) === JSON.stringify(action)) return state;
  if (row.revision !== action.revision) throw new Error("STALE_REVISION");
  if (
    row.completed_at &&
    (action.kind === "finish" || action.body !== row.body)
  )
    throw new Error("DOCUMENT_COMPLETED");
  if (action.kind === "finish" && wordCount(action.body) < 1)
    throw new Error("EMPTY_ESSAY");
  writingDocumentSchema.parse({
    ...row,
    body: action.body,
    notes: action.notes,
  });
  row.body = action.body;
  row.notes = action.notes;
  row.revision++;
  row.updated_at = stamp;
  row.last_input = action;
  if (action.kind === "finish") row.completed_at = stamp;
  return state;
}

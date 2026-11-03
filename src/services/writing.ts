import { supabase } from "./supabase";
import { loadSettings } from "./settings";
import {
  writingSnapshotSchema,
  type WritingAction,
  type WritingSnapshot,
  feedbackSchema,
} from "../types/writing";
import { writingTransition } from "../algorithms/writing";
import { localDate } from "../algorithms/dates";
import { withStudyLock, readLocalStudy, writeLocalStudy } from "./localStudy";
export async function writingAction(
  action: WritingAction,
  userId?: string,
): Promise<WritingSnapshot> {
  if (userId) {
    if (!supabase) throw new Error("CLOUD_NOT_CONFIGURED");
    const { data, error } = await supabase.rpc("writing_action", {
      p_action: action,
    });
    if (error) throw new Error(error.message);
    return writingSnapshotSchema.parse(data);
  }
  return withStudyLock(async () => {
    const settings = await loadSettings();
    if (!settings) throw new Error("SETTINGS_REQUIRED");
    const now = new Date(),
      study = readLocalStudy();
    study.writing = writingTransition(
      study.writing ?? { documents: [] },
      action,
      settings.timezone,
      now,
    );
    writeLocalStudy(study);
    return {
      ...study.writing,
      today: localDate(now, settings.timezone),
      server_now: now.toISOString(),
    };
  });
}
export async function requestWritingFeedback(documentId: string) {
  if (!supabase) throw new Error("CLOUD_NOT_CONFIGURED");
  const { data, error } = await supabase.functions.invoke("writing-feedback", {
    body: { documentId },
  });
  if (error) throw new Error("FEEDBACK_UNAVAILABLE");
  return feedbackSchema.parse(data);
}

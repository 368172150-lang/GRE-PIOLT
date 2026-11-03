import { supabase } from "./supabase";
import { loadSettings } from "./settings";
import {
  snapshotSchema,
  type StudyAction,
  type StudySnapshot,
} from "../types/study";
import { transition } from "../algorithms/study";
import { syncVocabularyStudy } from "../algorithms/vocabulary";
import { syncPracticeStudy } from "../algorithms/practice";
import { readLocalStudy, writeLocalStudy, withStudyLock } from "./localStudy";
export async function studyAction(
  action: StudyAction,
  userId?: string,
): Promise<StudySnapshot> {
  if (userId) {
    if (!supabase) throw new Error("CLOUD_NOT_CONFIGURED");
    const { data, error } = await supabase.rpc("study_action", {
      p_action: action,
    });
    if (error) throw new Error(error.message);
    return snapshotSchema.parse(data);
  }
  return withStudyLock(async () => {
    const settings = await loadSettings();
    if (!settings) throw new Error("SETTINGS_REQUIRED");
    const now = new Date(),
      before = syncPracticeStudy(
        syncVocabularyStudy(readLocalStudy(), now, settings.timezone, false),
        now,
        settings.timezone,
        false,
      );
    const after = syncPracticeStudy(
      syncVocabularyStudy(
        transition(before, settings, action, now),
        now,
        settings.timezone,
      ),
      now,
      settings.timezone,
    );
    writeLocalStudy(after);
    return after;
  });
}

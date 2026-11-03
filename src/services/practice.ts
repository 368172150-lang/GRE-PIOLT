import { supabase } from "./supabase";
import { loadSettings } from "./settings";
import {
  practiceSnapshotSchema,
  emptyPractice,
  type PracticeAction,
  type PracticeSnapshot,
} from "../types/practice";
import { originalBank } from "../data/questions";
import { practiceTransition, syncPracticeStudy } from "../algorithms/practice";
import { syncVocabularyStudy } from "../algorithms/vocabulary";
import { transition } from "../algorithms/study";
import { readLocalStudy, writeLocalStudy, withStudyLock } from "./localStudy";
export async function practiceAction(
  action: PracticeAction,
  userId?: string,
): Promise<PracticeSnapshot> {
  if (userId) {
    if (!supabase) throw new Error("CLOUD_NOT_CONFIGURED");
    const { data, error } = await supabase.rpc("practice_action", {
      p_action: action,
    });
    if (error) throw new Error(error.message);
    return practiceSnapshotSchema.parse(data);
  }
  return withStudyLock(async () => {
    const settings = await loadSettings();
    if (!settings) throw new Error("SETTINGS_REQUIRED");
    const now = new Date();
    let study = syncPracticeStudy(
      syncVocabularyStudy(readLocalStudy(), now, settings.timezone, false),
      now,
      settings.timezone,
      false,
    );
    if (["start", "submit", "mistake"].includes(action.kind))
      study = transition(study, settings, { kind: "ensure" }, now);
    const result = practiceTransition(
      study.practice ?? emptyPractice(),
      originalBank,
      settings,
      action,
      now,
    );
    study.practice = result.state;
    study = syncPracticeStudy(
      syncVocabularyStudy(study, now, settings.timezone),
      now,
      settings.timezone,
    );
    writeLocalStudy(study);
    return result.snapshot;
  });
}

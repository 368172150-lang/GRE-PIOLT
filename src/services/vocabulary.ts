import { supabase } from "./supabase";
import { loadSettings } from "./settings";
import {
  vocabSnapshotSchema,
  emptyVocab,
  type VocabAction,
  type VocabSnapshot,
} from "../types/vocabulary";
import { originalWords } from "../data/vocabulary";
import { vocabTransition, syncVocabularyStudy } from "../algorithms/vocabulary";
import { transition } from "../algorithms/study";
import { syncPracticeStudy } from "../algorithms/practice";
import { localDate } from "../algorithms/dates";
import { readLocalStudy, writeLocalStudy, withStudyLock } from "./localStudy";
export async function vocabularyAction(
  action: VocabAction,
  userId?: string,
): Promise<VocabSnapshot> {
  if (userId) {
    if (!supabase) throw new Error("CLOUD_NOT_CONFIGURED");
    const { data, error } = await supabase.rpc("vocab_action", {
      p_action: action,
    });
    if (error) throw new Error(error.message);
    return vocabSnapshotSchema.parse(data);
  }
  return withStudyLock(async () => {
    const settings = await loadSettings();
    if (!settings) throw new Error("SETTINGS_REQUIRED");
    const now = new Date(),
      today = localDate(now, settings.timezone);
    let study = syncPracticeStudy(
      readLocalStudy(),
      now,
      settings.timezone,
      false,
    );
    if (action.kind === "review")
      study = transition(
        syncVocabularyStudy(study, now, settings.timezone, false),
        settings,
        { kind: "ensure" },
        now,
      );
    const result = vocabTransition(
      study.vocabulary ?? emptyVocab(),
      originalWords,
      action,
      today,
      now,
      study.tasks.find(
        (task) => task.local_date === today && task.task_key === "new_words",
      )?.target ??
        Math.min(
          settings.new_words,
          Math.floor((settings.daily_minutes * 3) / 10),
        ),
    );
    study.vocabulary = result.state;
    study = syncPracticeStudy(
      syncVocabularyStudy(study, now, settings.timezone),
      now,
      settings.timezone,
    );
    writeLocalStudy(study);
    return result.snapshot;
  });
}

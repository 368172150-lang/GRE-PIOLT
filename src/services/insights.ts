import { studyAction } from "./study";
import { vocabularyAction } from "./vocabulary";
import { practiceAction } from "./practice";
import { writingAction } from "./writing";
import type { InsightsSource } from "../types/insights";
export async function loadInsights(userId?: string): Promise<InsightsSource> {
  const [study, vocabulary, practice, writing] = await Promise.all([
    studyAction({ kind: "ensure" }, userId),
    vocabularyAction({ kind: "ensure" }, userId),
    practiceAction({ kind: "ensure" }, userId),
    writingAction({ kind: "ensure" }, userId),
  ]);
  if (
    new Set([study.today, vocabulary.today, practice.today, writing.today])
      .size !== 1
  )
    throw new Error("DAY_CHANGED");
  return { study, vocabulary, practice, writing };
}

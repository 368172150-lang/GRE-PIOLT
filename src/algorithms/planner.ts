import type { StudySettings } from "../types";
import type { DailyTask, LearningSignals, TaskKey } from "../types/study";
export type PlannedTask = Pick<
  DailyTask,
  "task_key" | "target" | "estimated_minutes" | "focus_type"
>;
/** Rules mirrored by study_plan_spec SQL; parity is exercised in database tests. */
export function generatePlan(
  settings: StudySettings,
  signals: LearningSignals,
): PlannedTask[] {
  const budget = settings.daily_minutes;
  let left = budget;
  const result: PlannedTask[] = [];
  function add(
    key: TaskKey,
    target: number,
    cost: number,
    focus: string | null = null,
  ) {
    if (target > 0) {
      result.push({
        task_key: key,
        target,
        estimated_minutes: target * cost,
        focus_type: focus,
      });
      left -= target * cost;
    }
  }
  const due = Math.min(signals.dueReviews, Math.floor((budget * 7) / 10));
  add("review_words", due, 0.5);
  add(
    "new_words",
    Math.min(
      settings.new_words,
      Math.floor((budget * 3) / 10),
      Math.floor(left),
    ),
    1,
  );
  const error = (m: "verbal" | "quant") => {
    const s = signals[m];
    return s.attempts >= 3 ? 1 - s.correct / s.attempts : 0;
  };
  const order: ("verbal" | "quant")[] =
    error("quant") > error("verbal")
      ? ["quant", "verbal"]
      : ["verbal", "quant"];
  // Reserve a short reflection before distributing the remaining time to practice.
  add("mistakes", 1, 3);
  const remaining = left;
  for (const module of order) {
    const cost = module === "verbal" ? 3 : 2;
    const share = module === order[0] ? 6 : 4;
    add(
      module,
      Math.floor((remaining * share) / (cost * 10)),
      cost,
      signals[module].weakType,
    );
  }
  add("focus", budget, 0);
  return result;
}

import { addDays } from "./dates";
import type { WordProgress } from "../types/vocabulary";
/** SM-2 variant: ceiling intervals, EF rounded to 2dp, 365-day cap, failed recall restarts at one day. */
export function scheduleReview(
  previous: WordProgress,
  quality: number,
  today: string,
): Pick<
  WordProgress,
  | "repetitions"
  | "interval_days"
  | "ease_factor"
  | "due_date"
  | "status"
  | "lapses"
> {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5)
    throw new Error("INVALID_QUALITY");
  const repetitions = quality < 3 ? 0 : previous.repetitions + 1;
  const interval =
    quality < 3
      ? 1
      : repetitions === 1
        ? 1
        : repetitions === 2
          ? 6
          : Math.min(
              365,
              Math.max(
                1,
                Math.ceil(
                  (previous.interval_days *
                    Math.round(previous.ease_factor * 100)) /
                    100,
                ),
              ),
            );
  const ease =
    Math.max(
      130,
      Math.round(previous.ease_factor * 100) +
        10 -
        (5 - quality) * (8 + (5 - quality) * 2),
    ) / 100;
  return {
    repetitions,
    interval_days: interval,
    ease_factor: ease,
    due_date: addDays(today, interval),
    status:
      quality < 3
        ? "learning"
        : repetitions >= 3 && interval >= 15
          ? "mastered"
          : "review",
    lapses: previous.lapses + (quality < 3 ? 1 : 0),
  };
}

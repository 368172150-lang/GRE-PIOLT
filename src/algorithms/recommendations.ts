import { addDays } from "./dates";
import type { InsightsSource } from "../types/insights";
export interface Recommendation {
  key: string;
  minutes: number;
  target: number;
  href: string;
  reason: "due" | "mistake" | "weak" | "baseline" | "writing";
  evidence: number;
  accuracy?: number;
  difficulty?: number;
}
/** Explainable next-session allocation. Suggestions never modify tasks or fabricate progress. */
export function recommendNext(
  source: InsightsSource,
  budget: number,
): Recommendation[] {
  let remaining = Math.max(0, Math.min(180, Math.floor(budget)));
  const out: Recommendation[] = [],
    today = source.study.today,
    start = addDays(today, -29);
  const add = (r: Recommendation) => {
    if (r.minutes > 0 && r.minutes <= remaining) {
      out.push(r);
      remaining -= r.minutes;
    }
  };
  const due = source.vocabulary.progress.filter(
    (p) => p.due_date && p.due_date <= today && p.status !== "new",
  ).length;
  if (due && remaining >= 3) {
    const minutes = Math.min(Math.ceil(due * 0.5), Math.floor(remaining * 0.4));
    add({
      key: "review_words",
      minutes,
      target: Math.min(due, minutes * 2),
      href: "/vocabulary",
      reason: "due",
      evidence: due,
    });
  }
  const repeated = source.practice.mistakes
    .filter((m) => !m.mastered && m.frequency >= 2)
    .sort(
      (a, b) =>
        b.frequency - a.frequency ||
        b.last_wrong_at.localeCompare(a.last_wrong_at),
    )[0];
  if (repeated && remaining >= 5) {
    const q = source.practice.questions.find(
      (q) => q.id === repeated.question_id,
    );
    if (q)
      add({
        key: "mistake",
        minutes: 5,
        target: 1,
        href: `/${q.module}?questionId=${q.id}`,
        reason: "mistake",
        evidence: repeated.frequency,
        difficulty: q.difficulty,
      });
  }
  const groups = new Map<
    string,
    {
      module: "verbal" | "quant";
      type: string;
      correct: number;
      count: number;
      difficulty: number;
    }
  >();
  for (const a of source.practice.attempts.filter(
    (a) => a.local_date >= start && a.local_date <= today,
  )) {
    const q = a.question_snapshot,
      k = q.module + ":" + q.type,
      g = groups.get(k) ?? {
        module: q.module,
        type: q.type,
        correct: 0,
        count: 0,
        difficulty: 0,
      };
    g.correct += Number(a.is_correct);
    g.count++;
    g.difficulty += q.difficulty;
    groups.set(k, g);
  }
  const weak = [...groups.values()]
    .filter((g) => g.count >= 3 && g.correct / g.count < 0.7)
    .sort(
      (a, b) =>
        a.correct / a.count - b.correct / b.count ||
        b.count - a.count ||
        a.type.localeCompare(b.type),
    )[0];
  if (weak && remaining >= 4) {
    const minutes = Math.min(12, Math.floor(remaining * 0.5)),
      difficulty = Math.max(
        1,
        Math.min(5, Math.round(weak.difficulty / weak.count)),
      );
    add({
      key: weak.module,
      minutes,
      target: Math.max(1, Math.floor(minutes / 3)),
      href: `/${weak.module}?type=${weak.type}&difficulty=${difficulty}`,
      reason: "weak",
      evidence: weak.count,
      accuracy: Math.round((weak.correct / weak.count) * 100),
      difficulty,
    });
  }
  for (const module of ["verbal", "quant"] as const) {
    if (out.some((r) => r.key === module) || remaining < 3) continue;
    const minutes = Math.min(9, Math.floor(remaining / 2));
    add({
      key: module,
      minutes,
      target: Math.max(1, Math.floor(minutes / 3)),
      href: `/${module}`,
      reason: "baseline",
      evidence: source.practice.attempts.filter(
        (a) =>
          a.question_snapshot.module === module &&
          a.local_date >= start &&
          a.local_date <= today,
      ).length,
    });
  }
  if (budget >= 60 && remaining >= 10)
    add({
      key: "writing",
      minutes: Math.min(30, remaining),
      target: 1,
      href: "/writing",
      reason: "writing",
      evidence: 0,
    });
  if (remaining >= 2)
    add({
      key: "new_words",
      minutes: remaining,
      target: Math.min(20, remaining * 2),
      href: "/vocabulary",
      reason: "baseline",
      evidence: 0,
    });
  return out;
}

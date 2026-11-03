import { addDays } from "./dates";
import type { InsightsSource } from "../types/insights";
export type Period = 7 | 30 | 90;
export function aggregateAnalytics(source: InsightsSource, period: Period) {
  const today = source.study.today,
    start = addDays(today, 1 - period),
    inRange = (d: string) => d >= start && d <= today;
  const attempts = source.practice.attempts.filter((a) =>
    inRange(a.local_date),
  );
  const days = Array.from({ length: period }, (_, i) => {
    const date = addDays(start, i),
      rows = attempts.filter((a) => a.local_date === date);
    const accuracy = (module: string) => {
      const sample = rows.filter((a) => a.question_snapshot.module === module);
      return sample.length
        ? Math.round(
            (sample.filter((a) => a.is_correct).length / sample.length) * 100,
          )
        : null;
    };
    return {
      date,
      minutes: source.study.events
        .filter((e) => e.local_date === date)
        .reduce((n, e) => n + e.minutes, 0),
      completed: source.study.tasks.filter(
        (t) => t.local_date === date && t.completed_at,
      ).length,
      planned: source.study.tasks.filter((t) => t.local_date === date).length,
      checked: source.study.checkins.some((c) => c.local_date === date),
      verbal: accuracy("verbal"),
      quant: accuracy("quant"),
      verbalCount: rows.filter((a) => a.question_snapshot.module === "verbal")
        .length,
      quantCount: rows.filter((a) => a.question_snapshot.module === "quant")
        .length,
    };
  });
  const weeks = new Map<
    string,
    { week: string; completed: number; planned: number }
  >();
  for (const d of days) {
    const weekday = new Date(d.date + "T12:00:00Z").getUTCDay(),
      monday = addDays(d.date, -((weekday + 6) % 7));
    const row = weeks.get(monday) ?? { week: monday, completed: 0, planned: 0 };
    row.completed += d.completed;
    row.planned += d.planned;
    weeks.set(monday, row);
  }
  const vocabulary = ["new", "learning", "review", "mastered"].map(
    (status) => ({
      status,
      count: source.vocabulary.words.filter(
        (w) =>
          (source.vocabulary.progress.find((p) => p.vocabulary_id === w.id)
            ?.status ?? "new") === status,
      ).length,
    }),
  );
  const groups = new Map<
    string,
    {
      module: "verbal" | "quant";
      category: string;
      attempts: number;
      correct: number;
      difficulty: number;
    }
  >();
  for (const a of attempts) {
    const q = a.question_snapshot,
      key = q.module + ":" + q.category;
    const g = groups.get(key) ?? {
      module: q.module,
      category: q.category,
      attempts: 0,
      correct: 0,
      difficulty: 0,
    };
    g.attempts++;
    g.correct += Number(a.is_correct);
    g.difficulty += q.difficulty;
    groups.set(key, g);
  }
  const weaknesses = [...groups.values()]
    .map((g) => ({
      ...g,
      accuracy: Math.round((g.correct / g.attempts) * 100),
      difficulty: Math.round((g.difficulty / g.attempts) * 10) / 10,
    }))
    .sort(
      (a, b) =>
        a.accuracy - b.accuracy ||
        b.attempts - a.attempts ||
        a.category.localeCompare(b.category),
    );
  const summary = (module: string) => {
    const rows = attempts.filter((a) => a.question_snapshot.module === module);
    return {
      attempts: rows.length,
      correct: rows.filter((a) => a.is_correct).length,
      accuracy: rows.length
        ? Math.round(
            (rows.filter((a) => a.is_correct).length / rows.length) * 100,
          )
        : null,
    };
  };
  return {
    today,
    start,
    days,
    weeks: [...weeks.values()],
    vocabulary,
    weaknesses,
    verbal: summary("verbal"),
    quant: summary("quant"),
    totalMinutes: days.reduce((n, d) => n + d.minutes, 0),
    checkins: days.filter((d) => d.checked).length,
    completedWriting: source.writing.documents.filter(
      (d) => d.completed_at && inRange(d.local_date),
    ).length,
  };
}

import { describe, it, expect } from "vitest";
import { localDate, addDays, streaks } from "../algorithms/dates";
import { generatePlan } from "../algorithms/planner";
import { transition, summarize, weekTrend } from "../algorithms/study";
import {
  emptySnapshot,
  emptySignals,
  type StudyAction,
  type StudySnapshot,
} from "../types/study";
import { defaults } from "../features/settings/schema";
const settings = { ...defaults, display_name: "Pilot" };
const now = new Date("2026-11-02T15:59:59Z");
const apply = (state: StudySnapshot, action: StudyAction, time = now) =>
  transition(state, settings, action, time);
function finished() {
  let s = apply(emptySnapshot(), { kind: "ensure" });
  for (const t of s.tasks.filter((t) => t.task_key !== "focus"))
    s = apply(s, {
      kind: "toggle",
      date: s.today,
      taskId: t.id,
      completed: true,
    });
  return apply(s, {
    kind: "log",
    date: s.today,
    id: crypto.randomUUID(),
    minutes: 60,
    note: "Offline study",
  });
}
describe("calendar dates", () => {
  it("changes the day at the user timezone midnight", () => {
    expect(localDate(now, settings.timezone)).toBe("2026-11-02");
    expect(localDate(new Date("2026-11-02T16:00:00Z"), settings.timezone)).toBe(
      "2026-11-03",
    );
    expect(localDate(now, "America/Los_Angeles")).toBe("2026-11-02");
  });
  it("handles repeated and skipped DST hours and leap days", () => {
    expect(localDate(new Date("2026-11-01T05:30Z"), "America/New_York")).toBe(
      "2026-11-01",
    );
    expect(localDate(new Date("2026-11-01T06:30Z"), "America/New_York")).toBe(
      "2026-11-01",
    );
    expect(localDate(new Date("2026-03-08T06:59Z"), "America/New_York")).toBe(
      "2026-03-08",
    );
    expect(localDate(new Date("2026-03-08T07:01Z"), "America/New_York")).toBe(
      "2026-03-08",
    );
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("keeps a current streak from yesterday, deduplicates, and breaks on gaps", () => {
    expect(
      streaks(["2026-11-01", "2026-11-01", "2026-10-31"], "2026-11-02"),
    ).toEqual({ current: 2, longest: 2 });
    expect(streaks(["2026-10-30", "2026-10-31"], "2026-11-02")).toEqual({
      current: 0,
      longest: 2,
    });
    expect(streaks([], "2026-11-02")).toEqual({ current: 0, longest: 0 });
    expect(streaks(["2026-11-03"], "2026-11-02")).toEqual({
      current: 0,
      longest: 0,
    });
  });
});
describe("budgeted plan", () => {
  it.each([30, 60, 90])(
    "never exceeds %i minutes or the word goal",
    (budget) => {
      const plan = generatePlan(
        { ...settings, daily_minutes: budget, new_words: 100 },
        { ...emptySignals, dueReviews: 100 },
      );
      expect(
        plan.reduce((sum, t) => sum + t.estimated_minutes, 0),
      ).toBeLessThanOrEqual(budget);
      expect(plan.find((t) => t.task_key === "focus")?.target).toBe(budget);
      expect(plan.every((t) => t.target > 0)).toBe(true);
      expect(new Set(plan.map((t) => t.task_key)).size).toBe(plan.length);
    },
  );
  it("prioritizes due reviews and shifts practice to the weaker module", () => {
    const signal = {
      ...emptySignals,
      quant: { attempts: 10, correct: 2, weakType: "numeric_entry" },
      verbal: { attempts: 10, correct: 9, weakType: null },
    };
    const base = generatePlan(settings, emptySignals),
      adaptive = generatePlan(settings, signal);
    expect(
      adaptive.find((t) => t.task_key === "quant")!.target,
    ).toBeGreaterThan(base.find((t) => t.task_key === "quant")!.target);
    expect(adaptive.find((t) => t.task_key === "quant")!.focus_type).toBe(
      "numeric_entry",
    );
    expect(
      generatePlan(settings, { ...signal, dueReviews: 100 })[0].task_key,
    ).toBe("review_words");
  });
  it("does not infer weakness from one answer", () => {
    expect(
      generatePlan(settings, {
        ...emptySignals,
        quant: { attempts: 1, correct: 0, weakType: null },
      }),
    ).toEqual(generatePlan(settings, emptySignals));
  });
});
describe("study transitions", () => {
  it("initializes empty state and generates only one plan per date", () => {
    const s = apply(emptySnapshot(), { kind: "ensure" });
    const repeat = apply(s, { kind: "ensure" });
    expect(repeat).toEqual(s);
    expect(summarize(s, s.today)).toMatchObject({
      totalMinutes: 0,
      studyDays: 0,
      percent: 0,
      current: 0,
      longest: 0,
    });
    expect(weekTrend(s, s.today)).toHaveLength(7);
    expect(weekTrend(s, s.today).every((d) => d.minutes === 0)).toBe(true);
  });
  it("does not duplicate completed tasks and allows undo before check-in", () => {
    let s = apply(emptySnapshot(), { kind: "ensure" });
    const action = {
      kind: "toggle" as const,
      date: s.today,
      taskId: s.tasks[0].id,
      completed: true,
    };
    s = apply(s, action);
    s = apply(s, action);
    expect(summarize(s, s.today).completed).toBe(1);
    s = apply(s, { ...action, completed: false });
    expect(summarize(s, s.today).completed).toBe(0);
    expect(summarize(s, s.today).totalMinutes).toBe(0);
  });
  it("blocks early check-in without partially writing state", () => {
    const s = apply(emptySnapshot(), { kind: "ensure" });
    expect(() => apply(s, { kind: "checkin", date: s.today })).toThrow(
      "TASKS_INCOMPLETE",
    );
    expect(s.checkins).toHaveLength(0);
  });
  it("automatically completes only time task from actual saved logs", () => {
    let s = apply(emptySnapshot(), { kind: "ensure" });
    expect(() =>
      apply(s, {
        kind: "toggle",
        date: s.today,
        taskId: s.tasks.find((t) => t.task_key === "focus")!.id,
        completed: true,
      }),
    ).toThrow("AUTOMATIC_TASK");
    s = apply(s, {
      kind: "log",
      date: s.today,
      id: crypto.randomUUID(),
      minutes: 60,
      note: "",
    });
    expect(s.tasks.filter((t) => t.completed_at)).toHaveLength(1);
    expect(s.tasks.find((t) => t.task_key === "focus")?.completion_source).toBe(
      "automatic",
    );
  });
  it("deduplicates retries of the same time entry and rejects changed payload", () => {
    let s = apply(emptySnapshot(), { kind: "ensure" });
    const log = {
      kind: "log" as const,
      date: s.today,
      id: crypto.randomUUID(),
      minutes: 30,
      note: "review",
    };
    s = apply(s, log);
    s = apply(s, log);
    expect(s.events).toHaveLength(1);
    expect(() => apply(s, { ...log, minutes: 40 })).toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
  });
  it("checks in exactly once and locks completion and replanning", () => {
    let s = finished();
    s = apply(s, { kind: "checkin", date: s.today });
    s = apply(s, { kind: "checkin", date: s.today });
    expect(s.checkins).toHaveLength(1);
    expect(summarize(s, s.today)).toMatchObject({
      percent: 100,
      totalMinutes: 60,
      current: 1,
      longest: 1,
      studyDays: 1,
    });
    expect(() => apply(s, { kind: "replan", date: s.today })).toThrow(
      "DAY_LOCKED",
    );
    expect(() =>
      apply(s, {
        kind: "toggle",
        date: s.today,
        taskId: s.tasks[0].id,
        completed: false,
      }),
    ).toThrow("DAY_LOCKED");
  });
  it("rejects stale actions at midnight and preserves yesterday on next-day ensure", () => {
    let s = finished();
    s = apply(s, { kind: "checkin", date: s.today });
    const next = new Date("2026-11-02T16:00:00Z");
    expect(() =>
      apply(s, { kind: "note", date: s.today, note: "late" }, next),
    ).toThrow("DAY_CHANGED");
    const nextState = apply(s, { kind: "ensure" }, next);
    expect(nextState.days).toHaveLength(2);
    expect(summarize(nextState, "2026-11-03")).toMatchObject({
      completed: 0,
      todayMinutes: 0,
      current: 1,
    });
    expect(
      nextState.tasks.filter((t) => t.local_date === "2026-11-02"),
    ).toEqual(s.tasks);
  });
  it("handles timezone changes without duplicating existing local-date plans", () => {
    const s = finished();
    const west = transition(
      s,
      { ...settings, timezone: "Pacific/Honolulu" },
      { kind: "ensure" },
      now,
    );
    expect(west.days).toHaveLength(1);
    expect(west.days[0].timezone).toBe("Asia/Kuala_Lumpur");
  });
  it("requires explicit replan and reevaluates increased targets", () => {
    const s = finished();
    const settings90 = { ...settings, daily_minutes: 90 };
    const same = transition(s, settings90, { kind: "ensure" }, now);
    expect(same.days[0].budget).toBe(60);
    const replanned = transition(
      same,
      settings90,
      { kind: "replan", date: s.today },
      now,
    );
    expect(replanned.days[0].budget).toBe(90);
    expect(
      replanned.tasks.find((t) => t.task_key === "focus")?.completed_at,
    ).toBeNull();
    expect(
      replanned.tasks.find((t) => t.task_key === "new_words")?.completed_at,
    ).not.toBeNull();
  });
  it("saves notes and validates size and time bounds", () => {
    let s = apply(emptySnapshot(), { kind: "ensure" });
    s = apply(s, { kind: "note", date: s.today, note: "My reflection" });
    expect(s.days[0].notes).toBe("My reflection");
    expect(() =>
      apply(s, { kind: "note", date: s.today, note: "x".repeat(2001) }),
    ).toThrow("NOTE_TOO_LONG");
    for (const value of [0, 181, 1.5, NaN])
      expect(() =>
        apply(s, {
          kind: "log",
          date: s.today,
          id: crypto.randomUUID(),
          minutes: value,
          note: "",
        }),
      ).toThrow("INVALID_LOG");
    for (let i = 0; i < 8; i++)
      s = apply(s, {
        kind: "log",
        date: s.today,
        id: crypto.randomUUID(),
        minutes: 180,
        note: "",
      });
    expect(() =>
      apply(s, {
        kind: "log",
        date: s.today,
        id: crypto.randomUUID(),
        minutes: 1,
        note: "",
      }),
    ).toThrow("DAILY_LIMIT");
  });
});

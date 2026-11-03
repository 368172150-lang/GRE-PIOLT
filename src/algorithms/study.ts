import type { StudySettings } from "../types";
import {
  emptySnapshot,
  type StudyAction,
  type StudySnapshot,
  type DailyTask,
} from "../types/study";
import { generatePlan } from "./planner";
import { localDate, streaks, addDays } from "./dates";
function fail(code: string): never {
  throw new Error(code);
}
/** Pure state transition: input is not mutated, so failed writes cannot partially commit. */
export function transition(
  input: StudySnapshot,
  settings: StudySettings,
  action: StudyAction,
  now: Date,
): StudySnapshot {
  const state = structuredClone(input),
    date = localDate(now, settings.timezone),
    at = now.toISOString();
  state.today = date;
  if (action.kind !== "ensure" && action.date !== date) fail("DAY_CHANGED");
  let day = state.days.find((d) => d.local_date === date);
  if (!day) {
    day = {
      id: crypto.randomUUID(),
      local_date: date,
      timezone: settings.timezone,
      budget: settings.daily_minutes,
      notes: "",
      created_at: at,
    };
    state.days.push(day);
  }
  const checked = state.checkins.some((c) => c.local_date === date);
  const minutes = () =>
    state.events
      .filter((e) => e.local_date === date)
      .reduce((s, e) => s + e.minutes, 0);
  const createTasks = () => {
    const previous = state.tasks.filter((t) => t.local_date === date);
    const planned = generatePlan(settings, state.signals).map((spec) => {
      const old = previous.find((t) => t.task_key === spec.task_key);
      const keep =
        old?.completed_at &&
        old.target >= spec.target &&
        spec.task_key !== "focus";
      return {
        ...spec,
        id: old?.id ?? crypto.randomUUID(),
        local_date: date,
        completed_at: keep ? old.completed_at : null,
        completion_source: keep ? old.completion_source : null,
      } as DailyTask;
    });
    state.tasks = state.tasks
      .filter((t) => t.local_date !== date)
      .concat(planned);
    day.budget = settings.daily_minutes;
  };
  if (!state.tasks.some((t) => t.local_date === date)) createTasks();
  if (action.kind === "replan") {
    if (checked) fail("DAY_LOCKED");
    createTasks();
  }
  if (action.kind === "toggle") {
    if (checked) fail("DAY_LOCKED");
    const task = state.tasks.find(
      (t) => t.id === action.taskId && t.local_date === date,
    );
    if (!task) fail("TASK_NOT_FOUND");
    if (task.task_key === "focus") fail("AUTOMATIC_TASK");
    task.completed_at = action.completed ? (task.completed_at ?? at) : null;
    task.completion_source = action.completed ? "manual" : null;
  }
  if (action.kind === "note") {
    if (action.note.length > 2000) fail("NOTE_TOO_LONG");
    day.notes = action.note;
  }
  if (action.kind === "log") {
    if (
      !Number.isInteger(action.minutes) ||
      action.minutes < 1 ||
      action.minutes > 180 ||
      action.note.length > 2000
    )
      fail("INVALID_LOG");
    const existing = state.events.find((e) => e.id === action.id);
    if (existing) {
      if (
        existing.local_date !== date ||
        existing.minutes !== action.minutes ||
        existing.note !== action.note
      )
        fail("IDEMPOTENCY_CONFLICT");
    } else {
      if (minutes() + action.minutes > 1440) fail("DAILY_LIMIT");
      state.events.push({
        id: action.id,
        local_date: date,
        minutes: action.minutes,
        note: action.note,
        created_at: at,
      });
    }
  }
  const focus = state.tasks.find(
    (t) => t.local_date === date && t.task_key === "focus",
  );
  if (focus) {
    focus.completed_at =
      minutes() >= focus.target ? (focus.completed_at ?? at) : null;
    focus.completion_source = focus.completed_at ? "automatic" : null;
  }
  if (action.kind === "checkin" && !checked) {
    const tasks = state.tasks.filter((t) => t.local_date === date);
    if (!tasks.length || tasks.some((t) => !t.completed_at))
      fail("TASKS_INCOMPLETE");
    state.checkins.push({
      id: crypto.randomUUID(),
      local_date: date,
      timezone: day.timezone,
      created_at: at,
    });
  }
  return state;
}
export function summarize(state: StudySnapshot, today: string) {
  const tasks = state.tasks.filter((t) => t.local_date === today);
  const completed = tasks.filter((t) => t.completed_at).length;
  const totalMinutes = state.events.reduce((s, e) => s + e.minutes, 0);
  const todayMinutes = state.events
    .filter((e) => e.local_date === today)
    .reduce((s, e) => s + e.minutes, 0);
  const learnedDates = new Set([
    ...state.events.map((e) => e.local_date),
    ...state.tasks.filter((t) => t.completed_at).map((t) => t.local_date),
  ]);
  return {
    completed,
    total: tasks.length,
    percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    totalMinutes,
    todayMinutes,
    studyDays: learnedDates.size,
    ...streaks(
      state.checkins.map((c) => c.local_date),
      today,
    ),
  };
}
export function weekTrend(state: StudySnapshot, today: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return {
      date,
      minutes: state.events
        .filter((e) => e.local_date === date)
        .reduce((s, e) => s + e.minutes, 0),
    };
  });
}
export { emptySnapshot };

import type { StudySettings } from "../types";
import type { StudySnapshot } from "../types/study";
import {
  emptyPractice,
  filterSchema,
  type PracticeState,
  type PracticeAction,
  type PracticeSnapshot,
  type Question,
  type Solution,
} from "../types/practice";
import { gradeAnswer } from "./grading";
import { localDate } from "./dates";
export interface QuestionBank {
  questions: Question[];
  solutions: Record<string, Solution>;
}
function signature(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(signature).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${signature(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function practiceTransition(
  input: PracticeState,
  bank: QuestionBank,
  settings: StudySettings,
  action: PracticeAction,
  now: Date,
): { state: PracticeState; snapshot: PracticeSnapshot } {
  const state = structuredClone(input),
    today = localDate(now, settings.timezone),
    at = now.toISOString();
  const questions = bank.questions.filter(
    (q) => q.review_status === "reviewed",
  );
  const getQuestion = (id: string) => {
    const question = questions.find((q) => q.id === id);
    if (!question) throw new Error("QUESTION_NOT_FOUND");
    return question;
  };
  if ("date" in action && action.date !== today) throw new Error("DAY_CHANGED");
  if (action.kind === "favorite") {
    getQuestion(action.questionId);
    state.bookmarks = state.bookmarks.filter(
      (b) => b.question_id !== action.questionId,
    );
    if (action.value) state.bookmarks.push({ question_id: action.questionId });
  }
  if (action.kind === "start") {
    const existing = state.sessions.find((s) => s.id === action.id);
    if (existing) {
      if (signature(existing.start_input) !== signature(action))
        throw new Error("IDEMPOTENCY_CONFLICT");
    } else {
      if (
        !Number.isInteger(action.count) ||
        action.count < 1 ||
        action.count > 20 ||
        (action.minutes !== null &&
          (!Number.isInteger(action.minutes) ||
            action.minutes < 1 ||
            action.minutes > 120))
      )
        throw new Error("SESSION_SETTINGS");
      const filter = filterSchema.parse(action.filter);
      const attempted = new Set(
        state.attempts
          .filter((a) => a.local_date === today)
          .map((a) => a.question_id),
      );
      const selected = questions
        .filter(
          (q) =>
            q.module === action.module &&
            (!filter.questionId || q.id === filter.questionId) &&
            (!filter.type || q.type === filter.type) &&
            (!filter.category || q.category === filter.category) &&
            (!filter.difficulty || q.difficulty === filter.difficulty) &&
            (!filter.tag || q.tags.includes(filter.tag)) &&
            (!filter.favorites ||
              state.bookmarks.some((b) => b.question_id === q.id)),
        )
        .sort(
          (a, b) =>
            Number(attempted.has(a.id)) - Number(attempted.has(b.id)) ||
            a.id.localeCompare(b.id),
        )
        .slice(0, action.count);
      if (!selected.length) throw new Error("NO_QUESTIONS");
      for (const s of state.sessions.filter(
        (s) => s.module === action.module && !s.ended_at,
      ))
        s.ended_at = at;
      state.sessions.push({
        id: action.id,
        module: action.module,
        started_at: at,
        ended_at: null,
        local_date: today,
        timezone: settings.timezone,
        question_ids: selected.map((q) => q.id),
        deadline_at: action.minutes
          ? new Date(now.getTime() + action.minutes * 60000).toISOString()
          : null,
        current_started_at: at,
        start_input: structuredClone(action),
      });
    }
  }
  if (action.kind === "end") {
    const session = state.sessions.find((s) => s.id === action.sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    session.ended_at ??= at;
  }
  if (action.kind === "submit") {
    const existing = state.attempts.find((a) => a.id === action.id);
    if (existing) {
      if (signature(existing.request_input) !== signature(action))
        throw new Error("IDEMPOTENCY_CONFLICT");
    } else {
      const session = state.sessions.find((s) => s.id === action.sessionId);
      if (!session) throw new Error("SESSION_NOT_FOUND");
      if (session.ended_at) throw new Error("SESSION_ENDED");
      if (
        session.local_date !== today ||
        session.timezone !== settings.timezone
      )
        throw new Error("SESSION_DATE_CHANGED");
      if (
        session.deadline_at &&
        now.getTime() >= Date.parse(session.deadline_at)
      )
        throw new Error("SESSION_EXPIRED");
      const attempts = state.attempts.filter(
        (a) => a.session_id === session.id,
      );
      if (session.question_ids[attempts.length] !== action.questionId)
        throw new Error("QUESTION_ORDER");
      const q = getQuestion(action.questionId);
      if (q.revision !== action.revision) throw new Error("QUESTION_CHANGED");
      const solution = bank.solutions[q.id];
      if (!solution) throw new Error("SOLUTION_UNAVAILABLE");
      const correct = gradeAnswer(q, solution, action.answer);
      const elapsed = Math.min(
        86400,
        Math.max(
          0,
          Math.floor(
            (now.getTime() - Date.parse(session.current_started_at)) / 1000,
          ),
        ),
      );
      const attempt = {
        id: action.id,
        session_id: session.id,
        question_id: q.id,
        local_date: today,
        answer: structuredClone(action.answer),
        is_correct: correct,
        elapsed_seconds: elapsed,
        attempted_at: at,
        question_revision: q.revision,
        question_snapshot: structuredClone(q),
        feedback: structuredClone(solution),
        request_input: structuredClone(action),
      };
      state.attempts.push(attempt);
      session.current_started_at = at;
      if (attempts.length + 1 >= session.question_ids.length)
        session.ended_at = at;
      if (!correct) {
        const mistake = state.mistakes.find((m) => m.question_id === q.id);
        if (mistake) {
          mistake.frequency++;
          mistake.last_wrong_answer = structuredClone(action.answer);
          mistake.last_wrong_at = at;
          mistake.last_attempt_id = action.id;
          mistake.mastered = false;
          mistake.revision++;
        } else
          state.mistakes.push({
            id: crypto.randomUUID(),
            question_id: q.id,
            wrong_answer: structuredClone(action.answer),
            last_wrong_answer: structuredClone(action.answer),
            frequency: 1,
            reason: "",
            mastered: false,
            last_wrong_at: at,
            first_attempt_id: action.id,
            last_attempt_id: action.id,
            reviewed_on: null,
            revision: 0,
          });
      }
    }
  }
  if (action.kind === "mistake") {
    const mistake = state.mistakes.find((m) => m.id === action.mistakeId);
    if (!mistake) throw new Error("MISTAKE_NOT_FOUND");
    if (mistake.revision !== action.revision) throw new Error("STALE_MISTAKE");
    if (action.reason.length > 2000) throw new Error("NOTE_TOO_LONG");
    mistake.reason = action.reason;
    mistake.mastered = action.mastered;
    mistake.reviewed_on = today;
    mistake.revision++;
  }
  return { state, snapshot: { ...state, questions, today, server_now: at } };
}
export function syncPracticeStudy(
  input: StudySnapshot,
  now: Date,
  timezone: string,
  automatic = true,
): StudySnapshot {
  const state = structuredClone(input),
    p = state.practice ?? emptyPractice(),
    today = localDate(now, timezone),
    cutoff = now.getTime() - 30 * 86400000;
  for (const module of ["verbal", "quant"] as const) {
    const attempts = p.attempts.filter(
      (a) =>
        a.question_snapshot.module === module &&
        Date.parse(a.attempted_at) >= cutoff,
    );
    const groups = new Map<string, { n: number; errors: number }>();
    for (const a of attempts) {
      const type = a.question_snapshot.type,
        group = groups.get(type) ?? { n: 0, errors: 0 };
      group.n++;
      group.errors += Number(!a.is_correct);
      groups.set(type, group);
    }
    const weak =
      [...groups.entries()]
        .filter(([, g]) => g.n >= 3)
        .sort(
          ([a, x], [b, y]) =>
            y.errors / y.n - x.errors / x.n || y.n - x.n || a.localeCompare(b),
        )[0]?.[0] ?? null;
    state.signals[module] = {
      attempts: attempts.length,
      correct: attempts.filter((a) => a.is_correct).length,
      weakType: weak,
    };
  }
  if (automatic && !state.checkins.some((c) => c.local_date === today))
    for (const task of state.tasks.filter(
      (t) =>
        t.local_date === today &&
        ["verbal", "quant", "mistakes"].includes(t.task_key),
    )) {
      const count =
        task.task_key === "mistakes"
          ? p.mistakes.filter((m) => m.reviewed_on === today).length
          : new Set(
              p.attempts
                .filter(
                  (a) =>
                    a.local_date === today &&
                    a.question_snapshot.module === task.task_key,
                )
                .map((a) => a.question_id),
            ).size;
      if (count >= task.target && !task.completed_at) {
        task.completed_at = now.toISOString();
        task.completion_source = "automatic";
      }
    }
  return state;
}

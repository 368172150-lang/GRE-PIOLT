import { describe, it, expect } from "vitest";
import { writingTransition, wordCount } from "../algorithms/writing";
import { aggregateAnalytics } from "../algorithms/analytics";
import { recommendNext } from "../algorithms/recommendations";
import { emptySnapshot } from "../types/study";
import { emptyPractice, type Attempt } from "../types/practice";
import { initialProgress } from "../types/vocabulary";
import { originalQuestions, originalSolutions } from "../data/questions";
import { originalWords } from "../data/vocabulary";
import { defaults } from "../features/settings/schema";
import { practiceTransition } from "../algorithms/practice";

import type { InsightsSource } from "../types/insights";
const now = new Date("2026-11-03T16:10:00Z"),
  zone = "Asia/Kuala_Lumpur",
  id = crypto.randomUUID();
function source(): InsightsSource {
  return {
    study: { ...emptySnapshot(), today: "2026-11-04" },
    vocabulary: {
      today: "2026-11-04",
      new_word_target: 15,
      words: originalWords,
      progress: [],
      reviews: [],
      imported: 0,
    },
    practice: {
      ...emptyPractice(),
      today: "2026-11-04",
      server_now: now.toISOString(),
      questions: originalQuestions,
    },
    writing: {
      documents: [],
      today: "2026-11-04",
      server_now: now.toISOString(),
    },
  };
}
const start = () =>
  writingTransition(
    { documents: [] },
    { kind: "start", id, promptId: "public-spaces" },
    zone,
    now,
  );
function attempt(date: string, correct: boolean, questionIndex = 12): Attempt {
  const q = originalQuestions[questionIndex];
  return {
    id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    question_id: q.id,
    local_date: date,
    answer: originalSolutions[q.id].answer,
    is_correct: correct,
    elapsed_seconds: 50,
    attempted_at: now.toISOString(),
    question_revision: 1,
    question_snapshot: q,
    feedback: originalSolutions[q.id],
    request_input: null,
  };
}
describe("writing persistence rules", () => {
  it("starts at the user local date with a persisted 30 minute deadline and stable ID", () => {
    const s = start();
    expect(s.documents[0].local_date).toBe("2026-11-04");
    expect(Date.parse(s.documents[0].deadline_at) - now.getTime()).toBe(
      1800000,
    );
    expect(
      writingTransition(
        s,
        { kind: "start", id, promptId: "public-spaces" },
        zone,
        new Date(),
      ),
    ).toEqual(s);
  });
  it("rejects prompt substitution and unknown content", () => {
    expect(() =>
      writingTransition(
        start(),
        { kind: "start", id, promptId: "learning-failure" },
        zone,
        now,
      ),
    ).toThrow("IDEMPOTENCY_CONFLICT");
    expect(() =>
      writingTransition(
        { documents: [] },
        { kind: "start", id, promptId: "official" },
        zone,
        now,
      ),
    ).toThrow("INVALID_PROMPT");
  });
  it("saves atomically with idempotent retries and stale revision detection", () => {
    const s = start(),
      a = {
        kind: "save" as const,
        id,
        revision: 0,
        requestId: crypto.randomUUID(),
        body: "A clear claim.",
        notes: "Add a counterargument.",
      },
      n = writingTransition(s, a, zone, now);
    expect(s.documents[0].body).toBe("");
    expect(n.documents[0].revision).toBe(1);
    expect(writingTransition(n, a, zone, now)).toEqual(n);
    expect(() =>
      writingTransition(n, { ...a, body: "Other text" }, zone, now),
    ).toThrow("STALE_REVISION");
  });
  it("keeps overtime and cross-date drafts, finishes once and allows notes without rewriting history", () => {
    let s = start();
    const finish = {
      kind: "finish" as const,
      id,
      revision: 0,
      requestId: crypto.randomUUID(),
      body: "A reason with evidence.",
      notes: "",
    };
    s = writingTransition(s, finish, zone, new Date("2026-11-05T12:00:00Z"));
    expect(s.documents[0].local_date).toBe("2026-11-04");
    expect(writingTransition(s, finish, zone, now)).toEqual(s);
    expect(() =>
      writingTransition(
        s,
        { ...finish, revision: 1, body: "Replacement" },
        zone,
        now,
      ),
    ).toThrow("DOCUMENT_COMPLETED");
    s = writingTransition(
      s,
      { ...finish, kind: "save", revision: 1, notes: "Revise examples." },
      zone,
      now,
    );
    expect(s.documents[0].notes).toBe("Revise examples.");
  });
  it("rejects empty completions and overly large drafts", () => {
    expect(() =>
      writingTransition(
        start(),
        {
          kind: "finish",
          id,
          requestId: crypto.randomUUID(),
          revision: 0,
          body: " !!! ",
          notes: "",
        },
        zone,
        now,
      ),
    ).toThrow("EMPTY_ESSAY");
    expect(() =>
      writingTransition(
        start(),
        {
          kind: "save",
          id,
          requestId: crypto.randomUUID(),
          revision: 0,
          body: "x".repeat(60001),
          notes: "",
        },
        zone,
        now,
      ),
    ).toThrow();
  });
  it("defines English word count without counting punctuation", () => {
    expect(wordCount("Well-reasoned ideas aren't perfect. 2026! — 中文")).toBe(
      5,
    );
    expect(wordCount(" \n ! ")).toBe(0);
  });
  it("shared study transitions preserve writing documents", () => {
    const s = source();
    s.study.writing = start();
    expect(s.study.writing.documents).toHaveLength(1);
    const p = practiceTransition(
      s.practice,
      { questions: originalQuestions, solutions: originalSolutions },
      { ...defaults, display_name: "A" },
      { kind: "ensure" },
      now,
    );
    expect(p.state.attempts).toHaveLength(0);
    expect(s.study.writing).toEqual(start());
  });
});
describe("analytics uses actual records", () => {
  it.each([7, 30, 90] as const)(
    "returns %i calendar dates and gaps for no attempts",
    (period) => {
      const a = aggregateAnalytics(source(), period);
      expect(a.days).toHaveLength(period);
      expect(a.days.at(-1)?.date).toBe("2026-11-04");
      expect(a.quant.accuracy).toBeNull();
      expect(a.days.every((d) => d.quant === null)).toBe(true);
      expect(a.totalMinutes).toBe(0);
      expect(a.vocabulary.find((v) => v.status === "new")?.count).toBe(24);
    },
  );
  it("excludes old/future dates, counts repeats and never adds elapsed practice seconds to focus time", () => {
    const s = source();
    s.practice.attempts = [
      attempt("2026-11-04", true),
      attempt("2026-11-04", false),
      attempt("2026-10-29", true),
      attempt("2026-11-05", false),
      attempt("2026-10-27", false),
    ];
    s.study.events = [
      {
        id: crypto.randomUUID(),
        local_date: "2026-11-04",
        minutes: 20,
        note: "",
        created_at: now.toISOString(),
      },
    ];
    const a = aggregateAnalytics(s, 7);
    expect(a.quant).toEqual({ attempts: 3, correct: 2, accuracy: 67 });
    expect(a.days.at(-1)?.quant).toBe(50);
    expect(a.totalMinutes).toBe(20);
    expect(a.weaknesses[0]).toMatchObject({
      attempts: 3,
      correct: 2,
      difficulty: 2,
    });
  });
  it("groups partial weeks on Monday without including unselected tasks", () => {
    const s = source();
    s.study.tasks = [
      "2026-10-28",
      "2026-10-29",
      "2026-11-02",
      "2026-11-04",
    ].map((date) => ({
      id: crypto.randomUUID(),
      local_date: date,
      task_key: "verbal" as const,
      target: 1,
      estimated_minutes: 3,
      focus_type: null,
      completed_at: now.toISOString(),
      completion_source: "manual" as const,
    }));
    const a = aggregateAnalytics(s, 7);
    expect(a.weeks).toEqual([
      { week: "2026-10-26", completed: 1, planned: 1 },
      { week: "2026-11-02", completed: 2, planned: 2 },
    ]);
  });
  it("uses current vocabulary status independently of range and counts completed writing only", () => {
    const s = source();
    s.vocabulary.progress = [
      { ...initialProgress(originalWords[0].id), status: "mastered" },
    ];
    s.writing.documents = start().documents;
    let a = aggregateAnalytics(s, 7);
    expect(a.vocabulary.find((v) => v.status === "mastered")?.count).toBe(1);
    expect(a.completedWriting).toBe(0);
    s.writing.documents[0].completed_at = now.toISOString();
    a = aggregateAnalytics(s, 7);
    expect(a.completedWriting).toBe(1);
  });
});
describe("explainable adaptive suggestions", () => {
  it("does not infer weakness from one miss, and keeps a cold-start plan within budget", () => {
    const s = source();
    s.practice.attempts = [attempt("2026-11-04", false)];
    const r = recommendNext(s, 30);
    expect(r.some((r) => r.reason === "weak")).toBe(false);
    expect(r.reduce((n, r) => n + r.minutes, 0)).toBeLessThanOrEqual(30);
    expect(r.some((r) => r.key === "verbal")).toBe(true);
  });
  it("prioritizes due vocabulary and repeated unmastered mistakes before weakness", () => {
    const s = source();
    s.vocabulary.progress = [
      {
        ...initialProgress(originalWords[0].id),
        status: "review",
        due_date: "2026-11-04",
      },
    ];
    s.practice.attempts = [
      attempt("2026-11-04", false),
      attempt("2026-11-03", false),
      attempt("2026-11-02", true),
    ];
    s.practice.mistakes = [
      {
        id: crypto.randomUUID(),
        question_id: originalQuestions[12].id,
        wrong_answer: { choices: ["A"] },
        last_wrong_answer: { choices: ["A"] },
        frequency: 3,
        reason: "",
        mastered: false,
        last_wrong_at: now.toISOString(),
        first_attempt_id: null,
        last_attempt_id: null,
        reviewed_on: null,
        revision: 0,
      },
    ];
    const r = recommendNext(s, 60);
    expect(r.slice(0, 3).map((r) => r.reason)).toEqual([
      "due",
      "mistake",
      "weak",
    ]);
    expect(r[2]).toMatchObject({ accuracy: 33, evidence: 3, difficulty: 2 });
    expect(r[2].href).toContain("difficulty=2");
    expect(r.reduce((n, r) => n + r.minutes, 0)).toBeLessThanOrEqual(60);
  });
  it.each([0, 1, 3, 30, 60, 90, 180])(
    "never exceeds a %i minute budget or mutates source",
    (budget) => {
      const s = source(),
        before = structuredClone(s),
        r = recommendNext(s, budget);
      expect(r.reduce((n, r) => n + r.minutes, 0)).toBeLessThanOrEqual(budget);
      expect(s).toEqual(before);
      expect(r.every((r) => r.target > 0 && r.minutes > 0)).toBe(true);
    },
  );
  it("ignores future and older attempts when establishing a weak type", () => {
    const s = source();
    s.practice.attempts = [
      attempt("2026-11-05", false),
      attempt("2026-10-04", false),
      attempt("2026-11-04", false),
    ];
    expect(recommendNext(s, 60).some((r) => r.reason === "weak")).toBe(false);
  });
});

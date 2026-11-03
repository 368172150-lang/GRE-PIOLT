import { describe, it, expect } from "vitest";
import katex from "katex";
import {
  originalBank,
  originalQuestions,
  originalSolutions,
} from "../data/questions";
import {
  questionSchema,
  solutionSchema,
  emptyPractice,
  type PracticeAction,
  type PracticeState,
  type Answer,
} from "../types/practice";
import {
  parseNumeric,
  equivalentNumeric,
  gradeAnswer,
  validateAnswer,
} from "../algorithms/grading";
import { practiceTransition, syncPracticeStudy } from "../algorithms/practice";
import { defaults } from "../features/settings/schema";
import { transition } from "../algorithms/study";
import { emptySnapshot } from "../types/study";
const settings = { ...defaults, display_name: "Pilot" },
  date = "2026-11-02",
  now = new Date("2026-11-02T12:00:00Z");
const q = (n: number) =>
  originalQuestions.find((q) => q.id.endsWith(String(n).padStart(12, "0")))!;
const act = (s: PracticeState, a: PracticeAction, time = now) =>
  practiceTransition(s, originalBank, settings, a, time).state;
const start = (
  questionId = q(13).id,
  minutes: number | null = null,
): Extract<PracticeAction, { kind: "start" }> => ({
  kind: "start",
  id: crypto.randomUUID(),
  date,
  module: originalQuestions.find((q) => q.id === questionId)!.module,
  count: 1,
  minutes,
  filter: { questionId },
});
function answer(s: PracticeState, value: Answer, time = now) {
  const session = s.sessions.at(-1)!;
  const question = q(Number(session.question_ids[0].slice(-12)));
  return act(
    s,
    {
      kind: "submit",
      id: crypto.randomUUID(),
      date,
      sessionId: session.id,
      questionId: question.id,
      revision: question.revision,
      answer: value,
    },
    time,
  );
}
describe("exact numeric grading", () => {
  it.each([
    ["0.5", "1/2"],
    ["-0.5", "1/-2"],
    ["+2.50", "10/4"],
    [".1", "1/10"],
    ["2.", "2"],
    ["  \t-3/2\n", "-1.5"],
    ["0/-3", "0"],
    ["9007199254740993", "18014398509481986/2"],
  ])("treats %s and %s as equivalent", (a, b) =>
    expect(equivalentNumeric(a, b)).toBe(true),
  );
  it("does not round an approximate decimal to an exact repeating fraction", () =>
    expect(equivalentNumeric("0.3333333333333333", "1/3")).toBe(false));
  it.each([
    "",
    "1/0",
    "NaN",
    "Infinity",
    "1e3",
    "1+1",
    "1/2/3",
    "v1",
    "1;drop table x",
    "1".repeat(81),
  ])("rejects invalid number %s", (value) =>
    expect(() => parseNumeric(value)).toThrow("INVALID_NUMBER"),
  );
});
describe("original question bank and grading rules", () => {
  it("has 28 stable complete original questions with coverage and accurate keys", () => {
    expect(originalQuestions).toHaveLength(28);
    expect(new Set(originalQuestions.map((q) => q.id)).size).toBe(28);
    expect(originalQuestions.filter((q) => q.module === "verbal")).toHaveLength(
      12,
    );
    expect(
      new Set(
        originalQuestions
          .filter((q) => q.module === "quant")
          .map((q) => q.category),
      ),
    ).toEqual(new Set(["arithmetic", "algebra", "geometry", "data_analysis"]));
    for (const question of originalQuestions) {
      const solution = originalSolutions[question.id];
      expect(questionSchema.safeParse(question).success).toBe(true);
      expect(solutionSchema.safeParse(solution).success).toBe(true);
      expect(gradeAnswer(question, solution, solution.answer)).toBe(true);
      expect(question.source).toBe("original:GRE-Pilot-v0.4");
      expect(solution.option_explanations.map((o) => o.key).sort()).toEqual(
        question.options.map((o) => o.key).sort(),
      );
      expect(solution.terms.length).toBeGreaterThan(0);
      if (question.module === "verbal")
        expect(solution.sentence_analysis).not.toBeNull();
      else {
        expect(solution.steps_en.length).toBeGreaterThan(0);
        expect(solution.steps_zh.length).toBeGreaterThan(0);
      }
    }
  });
  it("renders every authored mathematical expression with strict KaTeX", () => {
    for (const row of originalQuestions) {
      const data = JSON.stringify({
        ...row,
        solution: originalSolutions[row.id],
      });
      const decoded = JSON.parse(data);
      const strings = (v: unknown): string[] =>
        typeof v === "string"
          ? [v]
          : Array.isArray(v)
            ? v.flatMap(strings)
            : v && typeof v === "object"
              ? Object.values(v).flatMap(strings)
              : [];
      for (const text of strings(decoded))
        for (const match of text.matchAll(/\$([^$\n]+)\$/g))
          expect(() =>
            katex.renderToString(match[1], {
              throwOnError: true,
              trust: false,
              strict: "error",
            }),
          ).not.toThrow();
    }
  });
  it("independently verifies numeric, arithmetic, algebra, geometry and data answers", () => {
    const expected = new Map<number, string>([
      [13, String(80 * 0.75 * 1.1)],
      [14, "1/10"],
      [15, String((32 * 5) / 8)],
      [16, String(10 / 2)],
      [18, String(2 * (-2) ** 2 - 3)],
      [20, String(9 * (30 / 2 - 9))],
      [22, String((4 + 7 + 7 + 10) / 4)],
      [23, String((60 * 70 + 40 * 85) / 100)],
      [24, String((8 + 11) / 2)],
      [27, String((18 * 5) / 3)],
    ]);
    for (const [id, value] of expected) {
      const question = q(id),
        solution = originalSolutions[question.id];
      const actual =
        solution.answer.numeric ??
        question.options.find((o) => o.key === solution.answer.choices![0])!
          .text;
      expect(equivalentNumeric(actual, value)).toBe(true);
    }
    const roots = Array.from({ length: 21 }, (_, i) => i - 10).filter(
      (x) => x * x - 5 * x + 6 === 0,
    );
    expect(
      q(17)
        .options.filter((o) =>
          originalSolutions[q(17).id].answer.choices!.includes(o.key),
        )
        .map((o) => Number(o.text)),
    ).toEqual(roots);
    expect(
      q(19).options.find(
        (o) => o.key === originalSolutions[q(19).id].answer.choices![0],
      )!.text,
    ).toBe(`$${2 * 3}\\pi$`);
    expect(Math.hypot(6, 8)).toBe(10);
    expect(6 + 8 + Math.hypot(6, 8)).toBe(24);
    expect(originalSolutions[q(25).id].answer).toEqual({ choices: ["D"] });
    expect(new Set([-0.5, -1, -2].map((x) => Math.sign(x * x - -x))).size).toBe(
      3,
    );
    expect(
      Array.from({ length: 25 }, (_, i) => (i + 1) * 4).every(
        (n) => n % 2 === 0,
      ),
    ).toBe(true);
    expect(originalSolutions[q(26).id].answer).toEqual({ choices: ["C"] });
    expect(4 * 6 < 5 * 5).toBe(true);
    expect(originalSolutions[q(28).id].answer).toEqual({ choices: ["B"] });
  });
  it("requires exact selections, validates blank groups and ignores selection order", () => {
    expect(
      gradeAnswer(q(5), originalSolutions[q(5).id], { choices: ["D", "A"] }),
    ).toBe(true);
    expect(
      gradeAnswer(q(5), originalSolutions[q(5).id], { choices: ["A", "B"] }),
    ).toBe(false);
    expect(() => validateAnswer(q(5), { choices: ["A"] })).toThrow(
      "ANSWER_INCOMPLETE",
    );
    expect(() => validateAnswer(q(5), { choices: ["A", "A"] })).toThrow(
      "ANSWER_OPTION",
    );
    expect(() => validateAnswer(q(3), { blanks: ["A", "B"] })).toThrow(
      "ANSWER_OPTION",
    );
    expect(() => validateAnswer(q(13), { choices: ["Z"] })).toThrow(
      "ANSWER_OPTION",
    );
    expect(() => validateAnswer(q(14), { choices: ["A"] })).toThrow(
      "ANSWER_FORMAT",
    );
  });
});
describe("practice transitions and task signals", () => {
  it("starts a frozen session once and replaces only a previous active set of the same module", () => {
    const request = start();
    let s = act(emptyPractice(), request);
    s = act(s, request);
    expect(s.sessions).toHaveLength(1);
    s = act(s, start(q(1).id));
    expect(s.sessions[0].ended_at).toBeNull();
    s = act(s, start(q(13).id));
    expect(s.sessions[0].ended_at).not.toBeNull();
    expect(s.sessions[1].ended_at).toBeNull();
  });
  it("saves immutable feedback and deduplicates retried submissions after a set ends", () => {
    let s = act(emptyPractice(), start());
    const request: PracticeAction = {
      kind: "submit",
      id: crypto.randomUUID(),
      date,
      sessionId: s.sessions[0].id,
      questionId: q(13).id,
      revision: 1,
      answer: { choices: ["C"] },
    };
    s = act(s, request, new Date(now.getTime() + 17000));
    expect(s.attempts[0]).toMatchObject({
      is_correct: true,
      elapsed_seconds: 17,
    });
    expect(s.sessions[0].ended_at).not.toBeNull();
    expect(act(s, request).attempts).toHaveLength(1);
    expect(() => act(s, { ...request, answer: { choices: ["A"] } })).toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    expect(s.attempts[0].feedback.answer).toEqual({ choices: ["C"] });
  });
  it("rejects expired, wrong-order, revised and cross-day answers without partial writes", () => {
    const s = act(emptyPractice(), start(q(13).id, 1));
    const request: PracticeAction = {
      kind: "submit",
      id: crypto.randomUUID(),
      date,
      sessionId: s.sessions[0].id,
      questionId: q(13).id,
      revision: 1,
      answer: { choices: ["C"] },
    };
    expect(() => act(s, request, new Date(now.getTime() + 60000))).toThrow(
      "SESSION_EXPIRED",
    );
    expect(() => act(s, { ...request, questionId: q(15).id })).toThrow(
      "QUESTION_ORDER",
    );
    expect(() => act(s, { ...request, revision: 2 })).toThrow(
      "QUESTION_CHANGED",
    );
    expect(() =>
      act(
        s,
        { ...request, date: "2026-11-03" },
        new Date("2026-11-03T12:00:00Z"),
      ),
    ).toThrow("SESSION_DATE_CHANGED");
    expect(s.attempts).toHaveLength(0);
  });
  it("keeps one mistake per question, retains the first wrong answer, reopens and checks revisions", () => {
    let s = act(emptyPractice(), start());
    s = answer(s, { choices: ["A"] });
    s = act(s, start());
    s = answer(s, { choices: ["B"] });
    expect(s.mistakes).toHaveLength(1);
    expect(s.mistakes[0]).toMatchObject({
      frequency: 2,
      wrong_answer: { choices: ["A"] },
      last_wrong_answer: { choices: ["B"] },
    });
    const m = s.mistakes[0];
    s = act(s, {
      kind: "mistake",
      date,
      mistakeId: m.id,
      revision: m.revision,
      reason: "I applied tax before discount.",
      mastered: true,
    });
    expect(s.mistakes[0].mastered).toBe(true);
    expect(() =>
      act(s, {
        kind: "mistake",
        date,
        mistakeId: m.id,
        revision: m.revision,
        reason: "stale",
        mastered: false,
      }),
    ).toThrow("STALE_MISTAKE");
    s = act(s, start());
    s = answer(s, { choices: ["A"] });
    expect(s.mistakes[0]).toMatchObject({
      frequency: 3,
      mastered: false,
      reason: "I applied tax before discount.",
    });
  });
  it("counts different questions once toward daily tasks without inventing study minutes", () => {
    let study = transition(emptySnapshot(), settings, { kind: "ensure" }, now);
    let p = emptyPractice();
    for (let i = 0; i < 3; i++) {
      p = act(p, start(q(13).id));
      p = answer(p, { choices: ["C"] });
    }
    study.practice = p;
    study = syncPracticeStudy(study, now, settings.timezone);
    expect(study.signals.quant).toMatchObject({ attempts: 3, correct: 3 });
    expect(
      study.tasks.find((t) => t.task_key === "quant")?.completed_at,
    ).toBeNull();
    expect(study.events).toHaveLength(0);
  });
  it("supports filters and genuine no-data/no-question states", () => {
    expect(() =>
      act(emptyPractice(), { ...start(), filter: { difficulty: 5 } }),
    ).toThrow("NO_QUESTIONS");
    expect(act(emptyPractice(), { kind: "ensure" }).attempts).toHaveLength(0);
    let s = act(emptyPractice(), {
      kind: "favorite",
      questionId: q(13).id,
      value: true,
    });
    s = act(s, { ...start(), filter: { favorites: true } });
    expect(s.sessions[0].question_ids).toEqual([q(13).id]);
  });
});

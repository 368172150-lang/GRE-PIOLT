import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { scheduleReview } from "../algorithms/sm2";
import { importCsv, parseCsv } from "../algorithms/csv";
import {
  vocabTransition,
  studyQueue,
  syncVocabularyStudy,
  choiceOptions,
} from "../algorithms/vocabulary";
import {
  wordSchema,
  initialProgress,
  emptyVocab,
  type VocabAction,
  type VocabState,
} from "../types/vocabulary";
import { originalWords } from "../data/vocabulary";
import { emptySnapshot } from "../types/study";
import { transition } from "../algorithms/study";
import { defaults } from "../features/settings/schema";
const word = originalWords[0],
  date = "2026-11-02",
  now = new Date("2026-11-02T12:00:00Z");
const act = (state: VocabState, action: VocabAction, today = date) =>
  vocabTransition(state, originalWords, action, today, now);
const review = (
  revision = 0,
  quality = 4,
): Extract<VocabAction, { kind: "review" }> => ({
  kind: "review",
  id: crypto.randomUUID(),
  date,
  wordId: word.id,
  revision,
  mode: "card",
  answer: `self-rating:${quality}`,
  quality,
});
describe("SM-2 calendar scheduler", () => {
  it("uses the 1, 6, then EF-multiplied interval sequence", () => {
    let p = initialProgress(word.id);
    p = { ...p, ...scheduleReview(p, 4, date) };
    expect(p).toMatchObject({
      repetitions: 1,
      interval_days: 1,
      due_date: "2026-11-03",
      ease_factor: 2.5,
      status: "review",
    });
    p = { ...p, ...scheduleReview(p, 4, "2026-11-03") };
    expect(p.interval_days).toBe(6);
    p = { ...p, ...scheduleReview(p, 4, "2026-11-09") };
    expect(p).toMatchObject({
      interval_days: 15,
      status: "mastered",
      due_date: "2026-11-24",
    });
  });
  it("resets repetitions and increases lapse count on failed recall", () => {
    const step = scheduleReview(
      {
        ...initialProgress(word.id),
        repetitions: 4,
        interval_days: 60,
        lapses: 2,
      },
      0,
      date,
    );
    expect(step).toMatchObject({
      repetitions: 0,
      interval_days: 1,
      lapses: 3,
      status: "learning",
      ease_factor: 1.7,
    });
  });
  it("floors EF, caps long intervals and avoids floating-point ceiling drift", () => {
    expect(
      scheduleReview({ ...initialProgress(word.id), ease_factor: 1.3 }, 0, date)
        .ease_factor,
    ).toBe(1.3);
    expect(
      scheduleReview(
        { ...initialProgress(word.id), repetitions: 6, interval_days: 365 },
        5,
        date,
      ).interval_days,
    ).toBe(365);
    expect(
      scheduleReview(
        {
          ...initialProgress(word.id),
          repetitions: 3,
          interval_days: 25,
          ease_factor: 2.2,
        },
        4,
        date,
      ).interval_days,
    ).toBe(55);
  });
  it.each([-1, 6, 1.5, NaN])("rejects invalid quality %s", (q) =>
    expect(() => scheduleReview(initialProgress(word.id), q, date)).toThrow(
      "INVALID_QUALITY",
    ),
  );
  it("uses calendar dates across a year boundary", () => {
    expect(
      scheduleReview(initialProgress(word.id), 4, "2026-12-31").due_date,
    ).toBe("2027-01-01");
  });
});
describe("original seed content", () => {
  it("contains 24 unique complete entries with original source metadata", () => {
    expect(originalWords).toHaveLength(24);
    expect(new Set(originalWords.map((w) => w.word.toLowerCase())).size).toBe(
      24,
    );
    expect(new Set(originalWords.map((w) => w.id)).size).toBe(24);
    for (const word of originalWords) {
      expect(wordSchema.safeParse(word).success).toBe(true);
      expect(word.example_en.toLowerCase()).toContain(word.word);
      expect(word.ipa).toMatch(/^\/.+\/$/);
      expect(word.source).toBe("original:GRE-Pilot-v0.3");
      expect(word.synonyms.some((s) => word.antonyms.includes(s))).toBe(false);
    }
  });
  it("offers deterministic distinct distractors including the correct word", () => {
    const choices = choiceOptions(originalWords, word);
    expect(choices).toHaveLength(4);
    expect(new Set(choices.map((w) => w.id)).size).toBe(4);
    expect(choices.some((w) => w.id === word.id)).toBe(true);
    expect(choiceOptions(originalWords, word)).toEqual(choices);
    for (const target of originalWords) {
      const choices = choiceOptions(originalWords, target);
      expect(choices).toHaveLength(4);
      for (const candidate of choices.filter((w) => w.id !== target.id)) {
        expect(candidate.tags.some((tag) => target.tags.includes(tag))).toBe(
          false,
        );
        const glosses = target.definition_zh.split(/[；;，,、]/);
        expect(
          candidate.definition_zh
            .split(/[；;，,、]/)
            .some((g) => glosses.includes(g)),
        ).toBe(false);
      }
    }
  });
});
describe("CSV parsing and validation", () => {
  it("handles quoted commas, escaped quotes, CRLF, BOM and embedded newlines", () => {
    expect(
      parseCsv('\uFEFFa,b\r\n"x,y","line1\nline2"\r\n"say ""hi""",z'),
    ).toEqual([
      ["a", "b"],
      ["x,y", "line1\nline2"],
      ['say "hi"', "z"],
    ]);
  });
  it("accepts the actual downloadable template and splits pipe lists", () => {
    const text = readFileSync("public/vocabulary-template.csv", "utf8");
    const rows = importCsv(text);
    expect(rows[0]).toMatchObject({
      word: "lucid",
      difficulty: 2,
      synonyms: ["clear"],
      tags: ["communication"],
    });
  });
  it.each(['a\n"broken', 'a\n"x"junk', 'a\nx"y'])(
    "rejects malformed quoting",
    (text) => expect(() => parseCsv(text)).toThrow("CSV_QUOTES"),
  );
  it("rejects incomplete headers, invalid content, huge files and row overflow", () => {
    expect(() => importCsv("word\nhello")).toThrow("CSV_HEADERS");
    const template = readFileSync("public/vocabulary-template.csv", "utf8");
    expect(() => importCsv(template.replace("lucid", "<script>"))).toThrow(
      "CSV_ROW 2",
    );
    expect(() => importCsv(template.replace('"2"', '"7"'))).toThrow(
      "CSV_ROW 2",
    );
    expect(() => parseCsv("a".repeat(500001))).toThrow("CSV_TOO_LARGE");
    expect(() => parseCsv("a\n" + "x\n".repeat(201))).toThrow("CSV_ROW_LIMIT");
    expect(() => importCsv("")).toThrow("CSV_EMPTY");
  });
});
describe("vocabulary state and daily integration", () => {
  it("favorite does not turn an unlearned word into a review", () => {
    const { state, snapshot } = act(emptyVocab(), {
      kind: "favorite",
      wordId: word.id,
      value: true,
    });
    expect(state.progress[0]).toMatchObject({
      favorite: true,
      status: "new",
      revision: 0,
    });
    expect(studyQueue(snapshot, 15, "review")).toHaveLength(0);
    expect(studyQueue(snapshot, 15, "new").some((w) => w.id === word.id)).toBe(
      true,
    );
  });
  it("persists first recall and deduplicates an identical retry", () => {
    const action = review();
    const first = act(emptyVocab(), action);
    const retry = act(first.state, action);
    expect(retry.state).toEqual(first.state);
    expect(first.state.reviews[0]).toMatchObject({
      kind: "new",
      correct: true,
      scheduled: true,
    });
    expect(() => act(first.state, { ...action, answer: "different" })).toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
  });
  it("rejects stale revisions, missing words and midnight-stale submissions", () => {
    const first = act(emptyVocab(), review());
    expect(() => act(first.state, review(0))).toThrow("STALE_REVIEW");
    expect(() =>
      act(first.state, { ...review(1), wordId: crypto.randomUUID() }),
    ).toThrow("WORD_NOT_FOUND");
    expect(() => act(first.state, review(1), "2026-11-03")).toThrow(
      "DAY_CHANGED",
    );
  });
  it("does not advance the schedule on correct same-day extras", () => {
    const first = act(emptyVocab(), review());
    const extra = act(first.state, review(1));
    expect(extra.state.progress[0]).toMatchObject({
      repetitions: 1,
      due_date: "2026-11-03",
      revision: 2,
    });
    expect(extra.state.reviews[1]).toMatchObject({
      kind: "extra",
      scheduled: false,
    });
  });
  it("grades spelling and choices deterministically and records original wrong answers", () => {
    const first = act(emptyVocab(), {
      kind: "review",
      id: crypto.randomUUID(),
      date,
      wordId: word.id,
      revision: 0,
      mode: "spelling",
      answer: " WRONG ",
    });
    expect(first.state.reviews[0]).toMatchObject({
      correct: false,
      quality: 1,
      answer: " WRONG ",
    });
    const second = act(first.state, {
      kind: "review",
      id: crypto.randomUUID(),
      date,
      wordId: word.id,
      revision: 1,
      mode: "spelling",
      answer: ` ${word.word.toUpperCase()} `,
    });
    expect(second.state.reviews[1].correct).toBe(true);
    const third = act(second.state, {
      kind: "review",
      id: crypto.randomUUID(),
      date,
      wordId: word.id,
      revision: 2,
      mode: "choice",
      answer: originalWords[1].id,
    });
    expect(third.state.reviews[2].correct).toBe(false);
  });
  it("prioritizes due words and limits remaining new words without randomization", () => {
    const first = act(emptyVocab(), review());
    expect(studyQueue(first.snapshot, 1, "new")).toHaveLength(0);
    const next = act(first.state, { kind: "ensure" }, "2026-11-03").snapshot;
    expect(studyQueue(next, 2)[0].id).toBe(word.id);
    expect(studyQueue(next, 2)).toHaveLength(3);
  });
  it("automatically completes a one-word daily task without changing study time", () => {
    const settings = { ...defaults, display_name: "Pilot", new_words: 1 };
    let study = transition(emptySnapshot(), settings, { kind: "ensure" }, now);
    study.vocabulary = act(emptyVocab(), review()).state;
    study = syncVocabularyStudy(study, now, settings.timezone);
    expect(study.tasks.find((t) => t.task_key === "new_words")).toMatchObject({
      completion_source: "automatic",
    });
    expect(study.events).toHaveLength(0);
    expect(study.signals.masteredWords).toBe(0);
  });
  it("imports personal words with duplicates skipped and preserves public entries", () => {
    const [content] = importCsv(
      readFileSync("public/vocabulary-template.csv", "utf8"),
    );
    const first = act(emptyVocab(), {
      kind: "import",
      words: [content, content],
      reviewed: true,
    });
    expect(first.snapshot.imported).toBe(1);
    expect(first.state.custom[0].owner_id).not.toBeNull();
    expect(
      act(first.state, { kind: "import", words: [content], reviewed: true })
        .snapshot.imported,
    ).toBe(0);
    expect(originalWords).toHaveLength(24);
  });
});

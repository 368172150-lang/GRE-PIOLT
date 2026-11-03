import {
  wordContentSchema,
  initialProgress,
  emptyVocab,
  type Word,
  type VocabAction,
  type VocabState,
  type VocabSnapshot,
  type WordProgress,
} from "../types/vocabulary";
import type { StudySnapshot } from "../types/study";
import { scheduleReview } from "./sm2";
import { localDate } from "./dates";
export function isDue(p: WordProgress | undefined, today: string) {
  return !!p && p.status !== "new" && !!p.due_date && p.due_date <= today;
}
export function availableWords(state: VocabState, seed: Word[]) {
  return [...seed, ...state.custom].sort((a, b) =>
    a.word.localeCompare(b.word),
  );
}
export function vocabTransition(
  input: VocabState,
  seed: Word[],
  action: VocabAction,
  today: string,
  now: Date,
  newWordTarget = 15,
): { state: VocabState; snapshot: VocabSnapshot } {
  const state = structuredClone(input);
  const words = availableWords(state, seed);
  let imported = 0;
  const getWord = (id: string) => {
    const w = words.find((w) => w.id === id);
    if (!w) throw new Error("WORD_NOT_FOUND");
    return w;
  };
  const getProgress = (id: string) => {
    let p = state.progress.find((p) => p.vocabulary_id === id);
    if (!p) {
      p = initialProgress(id);
      state.progress.push(p);
    }
    return p;
  };
  if (action.kind === "import") {
    if (
      !action.reviewed ||
      action.words.length < 1 ||
      action.words.length > 200
    )
      throw new Error("IMPORT_REVIEW_REQUIRED");
    for (const row of action.words) {
      const content = wordContentSchema.parse(row);
      if (
        words.some((w) => w.word.toLowerCase() === content.word.toLowerCase())
      )
        continue;
      const word: Word = {
        ...content,
        id: crypto.randomUUID(),
        owner_id: "00000000-0000-4000-8000-000000000001",
        source: "user-import",
        review_status: "reviewed",
      };
      state.custom.push(word);
      words.push(word);
      imported++;
    }
  }
  if (action.kind === "favorite") {
    getWord(action.wordId);
    getProgress(action.wordId).favorite = action.value;
  }
  if (action.kind === "review") {
    if (action.date !== today) throw new Error("DAY_CHANGED");
    const word = getWord(action.wordId);
    const existing = state.reviews.find((r) => r.id === action.id);
    if (existing) {
      const signature = (input: unknown) => {
        const record = input as Record<string, unknown>;
        return JSON.stringify(
          Object.keys(record)
            .filter((key) => record[key] !== undefined)
            .sort()
            .map((key) => [key, record[key]]),
        );
      };
      if (signature(existing.input) !== signature(action))
        throw new Error("IDEMPOTENCY_CONFLICT");
    } else {
      const p = getProgress(action.wordId);
      if (p.revision !== action.revision) throw new Error("STALE_REVIEW");
      const quality =
        action.mode === "card"
          ? action.quality
          : action.mode === "spelling"
            ? action.answer.trim().toLowerCase() === word.word.toLowerCase()
              ? 4
              : 1
            : action.answer === word.id
              ? 4
              : 1;
      if (
        quality === undefined ||
        !Number.isInteger(quality) ||
        quality < 0 ||
        quality > 5
      )
        throw new Error("INVALID_QUALITY");
      const first = p.status === "new",
        due = isDue(p, today),
        scheduled = first || due || quality < 3;
      if (scheduled) Object.assign(p, scheduleReview(p, quality, today));
      p.last_reviewed_at = now.toISOString();
      p.revision++;
      state.reviews.push({
        id: action.id,
        vocabulary_id: word.id,
        local_date: today,
        mode: action.mode,
        answer: action.answer,
        quality,
        correct: quality >= 3,
        kind: first ? "new" : due ? "review" : "extra",
        scheduled,
        created_at: now.toISOString(),
        input: structuredClone(action),
      });
    }
  }
  return {
    state,
    snapshot: {
      new_word_target: newWordTarget,
      today,
      words: availableWords(state, seed),
      progress: state.progress,
      reviews: state.reviews,
      imported,
    },
  };
}
export function syncVocabularyStudy(
  input: StudySnapshot,
  now: Date,
  timezone: string,
  automatic = true,
): StudySnapshot {
  const state = structuredClone(input),
    v = state.vocabulary ?? emptyVocab(),
    today = localDate(now, timezone);
  state.signals.dueReviews = v.progress.filter((p) => isDue(p, today)).length;
  state.signals.masteredWords = v.progress.filter(
    (p) => p.status === "mastered",
  ).length;
  if (automatic && !state.checkins.some((c) => c.local_date === today))
    for (const task of state.tasks.filter(
      (t) =>
        t.local_date === today &&
        ["new_words", "review_words"].includes(t.task_key),
    )) {
      const kind = task.task_key === "new_words" ? "new" : "review";
      const count = new Set(
        v.reviews
          .filter((r) => r.local_date === today && r.kind === kind)
          .map((r) => r.vocabulary_id),
      ).size;
      if (count >= task.target && !task.completed_at) {
        task.completed_at = now.toISOString();
        task.completion_source = "automatic";
      }
    }
  return state;
}
/** Due words first, then a stable new-word queue; never randomize away due dates. */
export function studyQueue(
  snapshot: VocabSnapshot,
  newWords: number,
  mode: "daily" | "review" | "new" = "daily",
) {
  const due = snapshot.words
    .filter((w) =>
      isDue(
        snapshot.progress.find((p) => p.vocabulary_id === w.id),
        snapshot.today,
      ),
    )
    .sort((a, b) => {
      const p = (id: string) =>
        snapshot.progress.find((p) => p.vocabulary_id === id)!.due_date!;
      return p(a.id).localeCompare(p(b.id)) || a.word.localeCompare(b.word);
    });
  const learnedToday = new Set(
    snapshot.reviews
      .filter((r) => r.local_date === snapshot.today && r.kind === "new")
      .map((r) => r.vocabulary_id),
  ).size;
  const fresh = snapshot.words
    .filter(
      (w) =>
        (snapshot.progress.find((p) => p.vocabulary_id === w.id)?.status ??
          "new") === "new",
    )
    .slice(0, Math.max(0, newWords - learnedToday));
  return mode === "review" ? due : mode === "new" ? fresh : [...due, ...fresh];
}
export function choiceOptions(words: Word[], word: Word) {
  const glosses = (w: Word) =>
    w.definition_zh
      .split(/[；;，,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
  const meaning = glosses(word);
  const alternatives = words
    .filter(
      (w) =>
        w.id !== word.id &&
        !glosses(w).some((s) => meaning.includes(s)) &&
        !word.tags.some((tag) => w.tags.includes(tag)) &&
        !word.synonyms.includes(w.word) &&
        !w.synonyms.includes(word.word),
    )
    .slice(0, 3);
  const options = [word, ...alternatives];
  const offset = parseInt(word.id.slice(-3), 16) % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
}

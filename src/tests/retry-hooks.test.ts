import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { practiceAction } from "../services/practice";
import { vocabularyAction } from "../services/vocabulary";
import { usePractice } from "../hooks/usePractice";
import { useVocabulary } from "../hooks/useVocabulary";
vi.mock("../services/practice", () => ({ practiceAction: vi.fn() }));
vi.mock("../services/vocabulary", () => ({ vocabularyAction: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it.each(["IDEMPOTENCY_CONFLICT", "NETWORK_INTERRUPTED"])(
  "practice retry distinguishes %s from a confirmed duplicate",
  async (message) => {
    const id = crypto.randomUUID(),
      snapshot = {
        today: "2026-11-03",
        server_now: new Date().toISOString(),
        questions: [],
        sessions: [],
        attempts: [{ id }],
        mistakes: [],
        bookmarks: [],
      };
    vi.mocked(practiceAction).mockResolvedValue(snapshot as never);
    const { result } = renderHook(() => usePractice());
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    vi.mocked(practiceAction).mockRejectedValueOnce(new Error(message));
    let returned: unknown;
    await act(async () => {
      returned = await result.current.run({
        kind: "submit",
        id,
        date: snapshot.today,
        sessionId: crypto.randomUUID(),
        questionId: crypto.randomUUID(),
        revision: 1,
        answer: { choices: ["A"] },
      });
    });
    if (message === "IDEMPOTENCY_CONFLICT") {
      expect(returned).toBeNull();
      expect(result.current.error).toContain(message);
    } else expect(returned).toEqual(snapshot);
  },
);
it.each(["IDEMPOTENCY_CONFLICT", "NETWORK_INTERRUPTED"])(
  "vocabulary retry distinguishes %s from a confirmed duplicate",
  async (message) => {
    const id = crypto.randomUUID(),
      snapshot = {
        today: "2026-11-03",
        new_word_target: 1,
        words: [],
        progress: [],
        reviews: [{ id }],
        imported: 0,
      };
    vi.mocked(vocabularyAction).mockResolvedValue(snapshot as never);
    const { result } = renderHook(() => useVocabulary());
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    vi.mocked(vocabularyAction).mockRejectedValueOnce(new Error(message));
    let returned: unknown;
    await act(async () => {
      returned = await result.current.run({
        kind: "review",
        date: snapshot.today,
        id,
        wordId: crypto.randomUUID(),
        revision: 0,
        mode: "spelling",
        answer: "text",
      });
    });
    if (message === "IDEMPOTENCY_CONFLICT") {
      expect(returned).toBeNull();
      expect(result.current.error).toContain(message);
    } else expect(returned).toEqual(snapshot);
  },
);

import { useCallback, useEffect, useRef, useState } from "react";
import { vocabularyAction } from "../services/vocabulary";
import type { VocabAction, VocabSnapshot } from "../types/vocabulary";
export function useVocabulary(userId?: string) {
  const [snapshot, setSnapshot] = useState<VocabSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(false),
    pending = useRef(false);
  const run = useCallback(
    async (action: VocabAction): Promise<VocabSnapshot | null> => {
      if (pending.current) return null;
      pending.current = true;
      setBusy(true);
      setError("");
      try {
        const next = await vocabularyAction(action, userId);
        if (active.current) setSnapshot(next);
        return next;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        try {
          const next = await vocabularyAction({ kind: "ensure" }, userId);
          if (active.current) setSnapshot(next);
          if (
            !message.includes("IDEMPOTENCY_CONFLICT") &&
            action.kind === "review" &&
            next.reviews.some((r) => r.id === action.id)
          )
            return next;
        } catch {
          /* Preserve the original failure and retry ID when refresh is unavailable. */
        }
        if (active.current) setError(message);
        return null;
      } finally {
        pending.current = false;
        if (active.current) setBusy(false);
      }
    },
    [userId],
  );
  useEffect(() => {
    active.current = true;
    void run({ kind: "ensure" });
    const refresh = () => {
      if (document.visibilityState !== "hidden") void run({ kind: "ensure" });
    };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [run]);
  return { snapshot, busy, error, run };
}

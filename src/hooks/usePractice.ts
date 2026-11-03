import { useState, useEffect, useRef, useCallback } from "react";
import { practiceAction } from "../services/practice";
import type { PracticeAction, PracticeSnapshot } from "../types/practice";
export function usePractice(userId?: string) {
  const [snapshot, setSnapshot] = useState<PracticeSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(false),
    pending = useRef(false);
  const run = useCallback(
    async (action: PracticeAction): Promise<PracticeSnapshot | null> => {
      if (pending.current) return null;
      pending.current = true;
      setBusy(true);
      setError("");
      try {
        const next = await practiceAction(action, userId);
        if (active.current) setSnapshot(next);
        return next;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        try {
          const next = await practiceAction({ kind: "ensure" }, userId);
          if (active.current) setSnapshot(next);
          if (
            !message.includes("IDEMPOTENCY_CONFLICT") &&
            ((action.kind === "submit" &&
              next.attempts.some((a) => a.id === action.id)) ||
              (action.kind === "start" &&
                next.sessions.some((s) => s.id === action.id)))
          )
            return next;
        } catch {
          /* A retry keeps its original request ID. */
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
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [run]);
  return { snapshot, busy, error, run };
}

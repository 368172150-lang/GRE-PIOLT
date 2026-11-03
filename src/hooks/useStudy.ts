import { useEffect, useRef, useState, useCallback } from "react";
import { studyAction } from "../services/study";
import type { StudyAction, StudySnapshot } from "../types/study";
import type { StudySettings } from "../types";
export function useStudy(settings: StudySettings, userId?: string) {
  const [snapshot, setSnapshot] = useState<StudySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false),
    generation = useRef(0),
    mounted = useRef(false);
  const run = useCallback(
    async (action: StudyAction) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      const current = ++generation.current;
      if (action.kind !== "ensure") {
        setError("");
        setNotice("");
      }
      try {
        const data = await studyAction(action, userId);
        if (mounted.current && current === generation.current) {
          setSnapshot(data);
          setError("");
          if (action.kind !== "ensure")
            setNotice(action.kind === "checkin" ? "CHECKED_IN" : "SAVED");
        }
        return true;
      } catch (e) {
        const code = e instanceof Error ? e.message : String(e);
        if (mounted.current) setError(code);
        if (code.includes("DAY_CHANGED")) {
          try {
            const data = await studyAction({ kind: "ensure" }, userId);
            if (mounted.current) setSnapshot(data);
          } catch {
            /* The original day-change error remains actionable via Retry. */
          }
        }
        return false;
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setBusy(false);
          setLoading(false);
        }
      }
    },
    [userId],
  );
  // Settings changes do not silently rewrite today's plan. Replan is an explicit action.
  const settingsVersion = JSON.stringify(settings);
  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    void run({ kind: "ensure" });
    const refresh = () => {
      if (document.visibilityState !== "hidden") void run({ kind: "ensure" });
    };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [run, settingsVersion]);
  return { snapshot, loading, busy, error, notice, run };
}

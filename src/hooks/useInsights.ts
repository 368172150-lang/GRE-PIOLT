import { useCallback, useEffect, useState, useRef } from "react";
import { loadInsights } from "../services/insights";
import type { InsightsSource } from "../types/insights";
export function useInsights(userId?: string) {
  const [loaded, setLoaded] = useState<{
      owner: string;
      data: InsightsSource;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const owner = userId ?? "local",
    active = useRef(false),
    version = useRef(0),
    currentOwner = useRef(owner);
  currentOwner.current = owner;
  const load = useCallback(async () => {
    const requestVersion = ++version.current;
    setBusy(true);
    try {
      const next = await loadInsights(userId);
      if (
        active.current &&
        version.current === requestVersion &&
        currentOwner.current === owner
      ) {
        setLoaded({ owner, data: next });
        setError("");
      }
    } catch (e) {
      if (active.current && version.current === requestVersion)
        setError(String(e));
    } finally {
      if (active.current && version.current === requestVersion) setBusy(false);
    }
  }, [userId, owner]);
  useEffect(() => {
    let live = true;
    active.current = true;
    const refresh = () => {
      if (live && document.visibilityState !== "hidden") void load();
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      live = false;
      active.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [load]);
  return {
    source: loaded?.owner === owner ? loaded.data : null,
    error,
    busy,
    load,
  };
}

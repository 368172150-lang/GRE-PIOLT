import { useEffect, useState, useRef, useCallback } from "react";
import { writingAction } from "../services/writing";
import type { WritingSnapshot } from "../types/writing";
export function useWriting(userId?: string) {
  const [saved, setSaved] = useState<{
      owner: string;
      data: WritingSnapshot;
    } | null>(null),
    [error, setError] = useState("");
  const owner = userId ?? "local",
    currentOwner = useRef(owner);
  currentOwner.current = owner;
  const setSnapshot = useCallback(
    (next: WritingSnapshot) => {
      if (currentOwner.current !== owner) return;
      setSaved((previous) =>
        previous?.owner === owner &&
        Date.parse(previous.data.server_now) > Date.parse(next.server_now)
          ? previous
          : { owner, data: next },
      );
    },
    [owner],
  );
  useEffect(() => {
    let active = true;
    const load = () => {
      void writingAction({ kind: "ensure" }, userId)
        .then((s) => {
          if (active) {
            setSnapshot(s);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener("storage", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
      window.removeEventListener("storage", load);
    };
  }, [userId, setSnapshot]);
  return {
    snapshot: saved?.owner === owner ? saved.data : null,
    setSnapshot,
    error,
    setError,
  };
}

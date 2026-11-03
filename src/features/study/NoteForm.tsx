import { useRef, useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import type { ActionRunner, Translate } from "./shared";
export function NoteForm({
  date,
  saved,
  busy,
  run,
  t,
}: {
  date: string;
  saved: string;
  busy: boolean;
  run: ActionRunner;
  t: Translate;
}) {
  const [note, setNote] = useState(saved);
  const lastSaved = useRef(saved);
  useEffect(() => {
    if (saved !== lastSaved.current) {
      const previous = lastSaved.current;
      setNote((current) => (current === previous ? saved : current));
      lastSaved.current = saved;
    }
  }, [saved]);
  return (
    <section className="panel">
      <h2>{t("今日学习备注", "Today’s study note")}</h2>
      <form
        className="compact-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run({ kind: "note", date, note });
        }}
      >
        <label className="sr-only" htmlFor="daily-note">
          {t("学习备注", "Study note")}
        </label>
        <textarea
          id="daily-note"
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t(
            "今天有什么收获？下一次想改进什么？",
            "What did you learn? What will you improve next time?",
          )}
        />
        <Button
          type="submit"
          disabled={busy || note === saved}
          variant="outline"
        >
          {t("保存备注", "Save note")}
        </Button>
      </form>
    </section>
  );
}

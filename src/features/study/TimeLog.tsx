import { useRef, useState } from "react";
import { Check, Clock } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { ActionRunner, Translate } from "./shared";
export function TimeLog({
  date,
  busy,
  run,
  t,
}: {
  date: string;
  busy: boolean;
  run: ActionRunner;
  t: Translate;
}) {
  const [minutes, setMinutes] = useState("30"),
    [note, setNote] = useState("");
  const [validation, setValidation] = useState("");
  const request = useRef<{ key: string; id: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setValidation("");
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 1 || value > 180) {
      setValidation(
        t("请输入 1–180 的整数分钟。", "Enter 1–180 whole minutes."),
      );
      return;
    }
    const key = JSON.stringify([date, value, note]);
    if (!request.current || request.current.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    const success = await run({
      kind: "log",
      date,
      id: request.current.id,
      minutes: value,
      note,
    });
    if (success) {
      request.current = null;
      setNote("");
    }
  }
  return (
    <section className="panel">
      <div className="section-title">
        <h2>{t("记录学习时长", "Log study time")}</h2>
        <Clock size={18} />
      </div>
      <form className="compact-form" onSubmit={submit} noValidate>
        <label>
          {t("本次学习分钟数", "Minutes studied")}
          <input
            type="number"
            min={1}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
          />
        </label>
        <label>
          {t("本次内容（可选）", "What did you study? (optional)")}
          <input
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(
              "例如：线下词汇复习",
              "For example: offline vocabulary review",
            )}
          />
        </label>
        {validation && (
          <p role="alert" className="error">
            {validation}
          </p>
        )}
        <Button disabled={busy} type="submit">
          {t("保存学习时长", "Save study time")}
          <Check size={15} />
        </Button>
        <small className="muted">
          {t(
            "仅记录你实际学习的时间。每次最多 180 分钟，每日最多 1440 分钟。",
            "Record time you actually studied. Up to 180 minutes per entry and 1,440 per day.",
          )}
        </small>
      </form>
    </section>
  );
}

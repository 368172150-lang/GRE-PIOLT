import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { MathText } from "../../components/MathText";
import { validateAnswer } from "../../algorithms/grading";
import type { Answer, Question, Solution } from "../../types/practice";
import { practiceError, type Translate } from "./shared";
export function AnswerForm({
  question: q,
  saved,
  solution,
  disabled,
  onSubmit,
  t,
}: {
  question: Question;
  saved?: Answer;
  solution?: Solution;
  disabled: boolean;
  onSubmit: (answer: Answer) => Promise<void>;
  t: Translate;
}) {
  const initial = (): Answer =>
    saved ??
    (q.format === "numeric"
      ? { numeric: "" }
      : q.format === "blanks"
        ? { blanks: Array(q.blank_count).fill("") }
        : { choices: [] });
  const [answer, setAnswer] = useState<Answer>(initial),
    [error, setError] = useState("");
  useEffect(() => {
    if (saved) setAnswer(saved);
  }, [saved]);
  const ready =
    q.format === "numeric"
      ? !!answer.numeric?.trim()
      : q.format === "blanks"
        ? answer.blanks?.filter(Boolean).length === q.blank_count
        : answer.choices?.length === q.selection_count;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      validateAnswer(q, answer);
      await onSubmit(answer);
    } catch (e) {
      setError(practiceError(e instanceof Error ? e.message : String(e), t));
    }
  }
  const option = (key: string, text: string, blank: number | null) => {
    const selected =
      blank === null
        ? (answer.choices ?? []).includes(key)
        : answer.blanks?.[blank] === key;
    const correct =
      solution &&
      (blank === null
        ? solution.answer.choices?.includes(key)
        : solution.answer.blanks?.[blank] === key);
    const isMultiple = q.format === "multiple";
    return (
      <label
        key={key}
        className={`practice-option ${selected ? "selected" : ""} ${solution && correct ? "correct-option" : solution && selected && !correct ? "wrong-option" : ""}`}
      >
        <input
          type={isMultiple ? "checkbox" : "radio"}
          name={`question-${q.id}-${blank ?? "choice"}`}
          aria-label={`${key}. ${text}`}
          checked={selected}
          disabled={
            disabled ||
            !!saved ||
            (isMultiple &&
              !selected &&
              (answer.choices?.length ?? 0) >= q.selection_count)
          }
          onChange={(e) => {
            if (blank !== null)
              setAnswer({
                blanks: (answer.blanks ?? Array(q.blank_count).fill("")).map(
                  (value, index) => (index === blank ? key : value),
                ),
              });
            else if (isMultiple)
              setAnswer({
                choices: e.target.checked
                  ? [...(answer.choices ?? []), key]
                  : (answer.choices ?? []).filter((value) => value !== key),
              });
            else setAnswer({ choices: [key] });
          }}
        />
        <span className="option-key">{key}</span>
        <span className="option-text">
          <MathText text={text} />
        </span>
      </label>
    );
  };
  return (
    <form className="practice-answer-form" onSubmit={submit} noValidate>
      {q.format === "numeric" ? (
        <label>
          {t("数值答案", "Numeric answer")}
          <input
            className="numeric-answer"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            value={answer.numeric ?? ""}
            onChange={(e) => setAnswer({ numeric: e.target.value })}
            disabled={disabled || !!saved}
            placeholder={t("例如 12、0.5 或 1/2", "For example 12, 0.5 or 1/2")}
          />
          <small className="muted">
            {t(
              "接受等值整数、小数或分数；不计算表达式。",
              "Equivalent whole numbers, decimals and fractions are accepted; expressions are not evaluated.",
            )}
          </small>
        </label>
      ) : q.format === "blanks" ? (
        Array.from({ length: q.blank_count }, (_, index) => (
          <fieldset className="blank-group" key={index}>
            <legend>{t(`第 ${index + 1} 空`, `Blank ${index + 1}`)}</legend>
            {q.options
              .filter((o) => o.blank_index === index)
              .map((o) => option(o.key, o.text, index))}
          </fieldset>
        ))
      ) : (
        <fieldset>
          <legend>
            {q.selection_count === 1
              ? t("选择一项", "Select one answer")
              : t(
                  `选择 ${q.selection_count} 项，当前已选 ${answer.choices?.length ?? 0} 项`,
                  `Select ${q.selection_count}; ${answer.choices?.length ?? 0} selected`,
                )}
          </legend>
          {q.options.map((o) => option(o.key, o.text, null))}
        </fieldset>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!saved && (
        <Button type="submit" disabled={disabled || !ready}>
          {t("提交答案", "Submit answer")}
        </Button>
      )}
    </form>
  );
}

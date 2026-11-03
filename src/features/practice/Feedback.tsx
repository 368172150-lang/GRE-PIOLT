import { CheckCircle2, AlertCircle } from "lucide-react";
import { MathText } from "../../components/MathText";
import { answerLabel } from "../../algorithms/grading";
import type { Attempt } from "../../types/practice";
import type { Translate } from "./shared";
export function Feedback({
  attempt: a,
  t,
}: {
  attempt: Attempt;
  t: Translate;
}) {
  const q = a.question_snapshot,
    s = a.feedback;
  return (
    <section
      className="practice-feedback"
      aria-label={t("答案与解析", "Answer and explanation")}
    >
      <div
        className={`grade-banner ${a.is_correct ? "right" : "wrong"}`}
        role="status"
      >
        {a.is_correct ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
        <div>
          <strong>
            {a.is_correct
              ? t("回答正确", "Correct answer")
              : t("已保存到错题本", "Saved to your mistake book")}
          </strong>
          <small>
            {t(
              `本题经过时间 ${a.elapsed_seconds} 秒`,
              `Elapsed time: ${a.elapsed_seconds} seconds`,
            )}
          </small>
        </div>
      </div>
      <div className="answer-summary">
        <p>
          <span>{t("你的答案", "Your answer")}</span>
          <MathText text={answerLabel(q, a.answer)} />
        </p>
        <p>
          <span>{t("正确答案", "Correct answer")}</span>
          <MathText text={answerLabel(q, s.answer)} />
        </p>
      </div>
      <h3>Explanation</h3>
      <p className="explanation-copy" lang="en">
        <MathText text={s.explanation_en} />
      </p>
      {s.steps_en.length > 0 && (
        <ol className="solution-steps" lang="en">
          {s.steps_en.map((step, i) => (
            <li key={i}>
              <MathText text={step} />
            </li>
          ))}
        </ol>
      )}
      <details className="explanation-details">
        <summary>
          {t("中文思路与逐步解析", "Chinese reasoning and steps")}
        </summary>
        <p>
          <MathText text={s.explanation_zh} />
        </p>
        {s.steps_zh.length > 0 && (
          <ol>
            {s.steps_zh.map((step, i) => (
              <li key={i}>
                <MathText text={step} />
              </li>
            ))}
          </ol>
        )}
      </details>
      {s.option_explanations.length > 0 && (
        <details className="explanation-details">
          <summary>{t("逐项答案解释", "Explain each option")}</summary>
          {s.option_explanations.map((option) => (
            <div className="option-explanation" key={option.key}>
              <strong>{option.key}</strong>
              <div>
                <p>
                  <MathText text={option.en} />
                </p>
                <p className="muted">
                  <MathText text={option.zh} />
                </p>
              </div>
            </div>
          ))}
        </details>
      )}
      <details className="explanation-details">
        <summary>
          {t(
            "关键词、数学术语与长句",
            "Keywords, math terms and sentence structure",
          )}
        </summary>
        {s.terms.map((term, i) => (
          <dl className="term-row" key={i}>
            <dt>{term.term}</dt>
            <dd>
              {term.en}
              <br />
              <span>{term.zh}</span>
            </dd>
          </dl>
        ))}
        {s.sentence_analysis && (
          <div className="sentence-analysis">
            <blockquote>{s.sentence_analysis.text}</blockquote>
            <p>{s.sentence_analysis.zh}</p>
          </div>
        )}
      </details>
    </section>
  );
}

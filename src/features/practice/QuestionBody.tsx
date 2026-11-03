import { MathText } from "../../components/MathText";
import type { Question } from "../../types/practice";
import { typeLabels, type Translate } from "./shared";
export function QuestionBody({
  question: q,
  t,
}: {
  question: Question;
  t: Translate;
}) {
  return (
    <>
      <div className="question-meta">
        <span>{t(...typeLabels[q.type])}</span>
        <span>
          {t("难度", "Level")} {q.difficulty}/5
        </span>
        <span>{t("原创示例", "Original sample")}</span>
      </div>
      {q.passage && (
        <section className="reading-passage" aria-label="Reading passage">
          <div className="eyebrow">READING PASSAGE</div>
          <p>{q.passage}</p>
        </section>
      )}
      <div className="question-prompt" lang="en">
        <MathText text={q.prompt} />
      </div>
      {q.format === "comparison" && (
        <div className="quantity-grid">
          <section>
            <h3>Quantity A</h3>
            <MathText text={q.quantity_a ?? ""} />
          </section>
          <section>
            <h3>Quantity B</h3>
            <MathText text={q.quantity_b ?? ""} />
          </section>
        </div>
      )}
    </>
  );
}

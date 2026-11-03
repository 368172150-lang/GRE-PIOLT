import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  recommendNext,
  type Recommendation,
} from "../../algorithms/recommendations";
import type { InsightsSource } from "../../types/insights";
import type { Translate } from "../study/shared";
export function Recommendations({
  source,
  budget,
  t,
}: {
  source: InsightsSource;
  budget: number;
  t: Translate;
}) {
  const rows = recommendNext(source, budget),
    names: Record<string, string> = {
      review_words: t("到期词汇", "Due words"),
      new_words: t("新词积累", "New vocabulary"),
      mistake: t("高频错题", "Repeated mistake"),
      verbal: "Verbal",
      quant: "Quant",
      writing: "Writing",
    };
  function reason(r: Recommendation) {
    switch (r.reason) {
      case "due":
        return t(
          `${r.evidence} 个词已到复习日期，优先巩固。`,
          `${r.evidence} words are due; consolidate them first.`,
        );
      case "mistake":
        return t(
          `同一道题累计错 ${r.evidence} 次；回看难度 ${r.difficulty}/5 的原题。`,
          `This question was missed ${r.evidence} times; revisit its ${r.difficulty}/5 difficulty.`,
        );
      case "weak":
        return t(
          `近 30 天该题型 ${r.evidence} 次作答，正确率 ${r.accuracy}%；建议难度 ${r.difficulty}/5。`,
          `Over 30 days: ${r.evidence} attempts, ${r.accuracy}% correct in this type. Suggested difficulty ${r.difficulty}/5.`,
        );
      case "writing":
        return t(
          "预算允许，留一段时间练习论证或修改。",
          "Your budget allows time for an argument or revision.",
        );
      default:
        return r.key === "new_words"
          ? t(
              "剩余预算用于少量新词，学习量可自行调整。",
              "Use the remaining budget for a small set of new words.",
            )
          : t(
              `近 30 天有 ${r.evidence} 次作答；先保持均衡练习。`,
              `${r.evidence} attempts in 30 days; maintain balanced practice.`,
            );
    }
  }
  return (
    <section className="panel recommendations">
      <div className="section-head">
        <h2>
          <Sparkles size={18} /> {t("下一次怎么学", "Your next study session")}
        </h2>
        <span className="muted small">
          {rows.reduce((n, r) => n + r.minutes, 0)} / {budget} min
        </span>
      </div>
      <p className="muted small">
        {t(
          "规则建议，依据最近 30 天记录。不会改写今日任务或自动记录学习时长。",
          "Rule-based suggestions from the last 30 days. They do not modify tasks or record study time.",
        )}
      </p>
      <div className="recommendation-grid">
        {rows.map((r) => (
          <Link key={r.key} to={r.href} className="recommendation-card">
            <div className="section-head">
              <strong>{names[r.key]}</strong>
              <span>{r.minutes} min</span>
            </div>
            <p>{reason(r)}</p>
            <span className="small">
              {t(
                `建议 ${r.target} ${r.key === "review_words" || r.key === "new_words" ? "词" : r.key === "writing" ? "段练习" : "题"}`,
                `Suggested target: ${r.target} ${r.key.includes("words") ? "words" : r.key === "writing" ? "writing block" : "questions"}`,
              )}{" "}
              <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
      <p className="small muted">
        {t(
          "少于 3 次作答不判断薄弱题型。正确率会受题目难度、样本量和重复练习影响；建议不代表能力评分。",
          "Fewer than 3 attempts do not establish a weak type. Difficulty, sample size and repeats affect accuracy; suggestions are not ability scores.",
        )}
      </p>
    </section>
  );
}

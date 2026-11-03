import { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, ArrowRight, CheckCircle2, Filter } from "lucide-react";
import { Button } from "../components/ui/button";
import { useAuth } from "../features/auth/AuthProvider";
import { usePractice } from "../hooks/usePractice";
import { QuestionBody } from "../features/practice/QuestionBody";
import { Feedback } from "../features/practice/Feedback";
import { MathText } from "../components/MathText";
import { answerLabel } from "../algorithms/grading";
import {
  typeLabels,
  practiceError,
  type Translate,
  type PracticeRunner,
} from "../features/practice/shared";
import type { Mistake } from "../types/practice";
export function Mistakes({ t }: { t: Translate }) {
  const { user } = useAuth(),
    { snapshot, busy, error, run } = usePractice(user?.id);
  const [module, setModule] = useState(""),
    [type, setType] = useState(""),
    [status, setStatus] = useState("active"),
    [sort, setSort] = useState("frequency"),
    [selected, setSelected] = useState(""),
    [notice, setNotice] = useState("");
  if (!snapshot)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"} className={error ? "error" : ""}>
          {error
            ? practiceError(error, t)
            : t("正在读取错题…", "Loading your mistakes…")}
        </p>
        {error && (
          <Button onClick={() => run({ kind: "ensure" })}>
            {t("重试", "Retry")}
          </Button>
        )}
      </section>
    );
  const questionFor = (m: Mistake) =>
    snapshot.attempts.find((a) => a.id === m.first_attempt_id)
      ?.question_snapshot ??
    snapshot.questions.find((q) => q.id === m.question_id);
  const filtered = snapshot.mistakes
    .filter((m) => {
      const q = questionFor(m);
      return (
        q &&
        (!module || q.module === module) &&
        (!type || q.type === type) &&
        (status === "all" ||
          (status === "active" && !m.mastered) ||
          (status === "mastered" && m.mastered))
      );
    })
    .sort((a, b) =>
      sort === "frequency"
        ? b.frequency - a.frequency ||
          b.last_wrong_at.localeCompare(a.last_wrong_at)
        : b.last_wrong_at.localeCompare(a.last_wrong_at),
    );
  const mistake = filtered.find((m) => m.id === selected) ?? filtered[0];
  const first = mistake
    ? snapshot.attempts.find((a) => a.id === mistake.first_attempt_id)
    : undefined;
  const original = mistake ? questionFor(mistake) : undefined;
  return (
    <>
      <div className="dashboard-heading">
        <div className="page-heading">
          <div className="eyebrow">REFLECT. REVISIT. REMEMBER.</div>
          <h1>{t("错题本", "Mistake Book")}</h1>
          <p className="muted">
            {t(
              "保留第一次犯错的线索，也记录后来理解的过程。",
              "Keep the first wrong turn and the understanding that follows.",
            )}
          </p>
        </div>
        <span className="practice-bank-label">
          {snapshot.mistakes.filter((m) => !m.mastered).length}{" "}
          {t("题待回顾", "to revisit")}
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {practiceError(error, t)}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <section className="panel mistake-filters">
        <Filter size={18} />
        <label>
          {t("模块", "Module")}
          <select
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setType("");
            }}
          >
            <option value="">{t("全部模块", "All modules")}</option>
            <option value="verbal">Verbal</option>
            <option value="quant">Quant</option>
          </select>
        </label>
        <label>
          {t("题型", "Question type")}
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t("全部题型", "All types")}</option>
            {[
              ...new Set(
                snapshot.mistakes
                  .map(questionFor)
                  .filter((q) => q && (!module || q.module === module))
                  .map((q) => q!.type),
              ),
            ].map((value) => (
              <option key={value} value={value}>
                {t(...typeLabels[value])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("掌握状态", "Mastery status")}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">{t("待回顾", "To revisit")}</option>
            <option value="mastered">{t("已掌握", "Mastered")}</option>
            <option value="all">{t("全部状态", "All states")}</option>
          </select>
        </label>
        <label>
          {t("排序", "Sort by")}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="frequency">
              {t("错误次数最多", "Most errors")}
            </option>
            <option value="recent">{t("最近出错", "Most recent")}</option>
          </select>
        </label>
      </section>
      {!filtered.length ? (
        <section className="panel practice-empty">
          <Bookmark size={32} />
          <h2>
            {snapshot.mistakes.length
              ? t("此筛选下没有错题", "No mistakes match")
              : t("还没有错题记录", "No mistakes yet")}
          </h2>
          <p>
            {t(
              "实际答错的题目会自动记录在这里。",
              "Questions you answer incorrectly will appear here automatically.",
            )}
          </p>
          <div className="report-actions">
            <Button asChild>
              <Link to="/verbal">
                {t("练习 Verbal", "Practice Verbal")}
                <ArrowRight size={14} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/quant">{t("练习 Quant", "Practice Quant")}</Link>
            </Button>
          </div>
        </section>
      ) : (
        <div className="mistake-workspace">
          <aside
            className="panel mistake-list"
            aria-label={t("错题列表", "Mistake list")}
          >
            {filtered.map((m) => {
              const q = questionFor(m)!;
              return (
                <button
                  key={m.id}
                  aria-pressed={mistake?.id === m.id}
                  className={mistake?.id === m.id ? "active" : ""}
                  onClick={() => {
                    setSelected(m.id);
                    setNotice("");
                  }}
                >
                  <span>
                    {q.module === "verbal" ? "VERBAL" : "QUANT"} ·{" "}
                    {t(...typeLabels[q.type])}
                  </span>
                  <strong>{q.prompt.replace(/\$/g, "").slice(0, 120)}</strong>
                  <small>
                    {t(`${m.frequency} 次错误`, `${m.frequency} errors`)} ·{" "}
                    {m.last_wrong_at.slice(0, 10)}
                    {m.mastered && <CheckCircle2 size={12} />}
                  </small>
                </button>
              );
            })}
          </aside>
          <section className="panel mistake-detail">
            {original && (
              <>
                <div className="section-title">
                  <h2>{t("首次错误记录", "First wrong attempt")}</h2>
                  <Button asChild variant="outline">
                    <Link to={`/${original.module}?questionId=${original.id}`}>
                      {t("重新练习", "Practice again")}
                      <ArrowRight size={14} />
                    </Link>
                  </Button>
                </div>
                <p className="panel-description">
                  {t(
                    `累计出错 ${mistake.frequency} 次。以下保留首次错误时的题目、答案和解析。`,
                    `${mistake.frequency} recorded errors. The original question, answer and explanation are preserved below.`,
                  )}
                </p>
                <QuestionBody question={original} t={t} />
                <div className="original-wrong-answer">
                  <strong>{t("原始错误答案", "Original wrong answer")}</strong>
                  <p>
                    <MathText
                      text={answerLabel(original, mistake.wrong_answer)}
                    />
                  </p>
                </div>
                {first && <Feedback attempt={first} t={t} />}
                <MistakeNote
                  date={snapshot.today}
                  key={mistake.id}
                  mistake={mistake}
                  run={run}
                  busy={busy}
                  t={t}
                  onSaved={() =>
                    setNotice(
                      t(
                        "回顾记录已保存。已掌握的题目可在对应筛选中查看。",
                        "Review saved. Mastered items are available under the mastery filter.",
                      ),
                    )
                  }
                />
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
function MistakeNote({
  mistake,
  run,
  busy,
  t,
  onSaved,
  date,
}: {
  date: string;
  mistake: Mistake;
  run: PracticeRunner;
  busy: boolean;
  t: Translate;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    reason: mistake.reason,
    mastered: mistake.mastered,
    revision: mistake.revision,
  });
  const stale = draft.revision !== mistake.revision;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = await run({
      kind: "mistake",
      date,
      mistakeId: mistake.id,
      ...draft,
    });
    if (result) {
      const next = result.mistakes.find((m) => m.id === mistake.id);
      if (next)
        setDraft({
          reason: next.reason,
          mastered: next.mastered,
          revision: next.revision,
        });
      onSaved();
    }
  }
  return (
    <section className="mistake-notes">
      <h3>{t("把错误变成下一次的提醒", "Turn the error into a reminder")}</h3>
      {stale && (
        <div className="time-alert">
          {t(
            "记录已在另一处更新。载入最新记录会放弃未保存的修改。",
            "This record changed elsewhere. Loading it will discard unsaved edits.",
          )}
          <Button
            variant="outline"
            onClick={() =>
              setDraft({
                reason: mistake.reason,
                mastered: mistake.mastered,
                revision: mistake.revision,
              })
            }
          >
            {t("载入最新记录", "Load latest record")}
          </Button>
        </div>
      )}
      <form onSubmit={save}>
        <label>
          {t("错误原因与改进计划", "Error reason and improvement plan")}
          <textarea
            rows={4}
            maxLength={2000}
            value={draft.reason}
            onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            placeholder={t(
              "例如：漏看转折词；先核对单位，再计算。",
              "For example: missed a contrast word; check units before calculating.",
            )}
          />
        </label>
        <label className="mastery-checkbox">
          <input
            type="checkbox"
            checked={draft.mastered}
            onChange={(e) => setDraft({ ...draft, mastered: e.target.checked })}
          />
          {t("标记已掌握", "Mark as mastered")}
        </label>
        <Button type="submit" disabled={busy || stale}>
          {t("保存并记为今日回顾", "Save and record today’s review")}
          <CheckCircle2 size={15} />
        </Button>
      </form>
    </section>
  );
}

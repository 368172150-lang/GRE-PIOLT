import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  Star,
  Target,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { MathText } from "../components/MathText";
import { useAuth } from "../features/auth/AuthProvider";
import { usePractice } from "../hooks/usePractice";
import { PracticeSessionView } from "../features/practice/PracticeSessionView";
import {
  typeLabels,
  categoryLabels,
  practiceError,
  type Translate,
} from "../features/practice/shared";
import type { StudySettings } from "../types";
import {
  questionTypeSchema,
  type PracticeFilter,
  type Question,
} from "../types/practice";
export function Practice({
  module,
  settings,
  t,
}: {
  module: "verbal" | "quant";
  settings: StudySettings;
  t: Translate;
}) {
  const { user } = useAuth(),
    { snapshot, busy, error, run } = usePractice(user?.id);
  const [search, setSearch] = useSearchParams();
  const requested = search.get("questionId");
  const routed = useRef("");
  const [selected, setSelected] = useState<string | null>(null),
    [type, setType] = useState(
      questionTypeSchema.safeParse(search.get("type")).success
        ? search.get("type")!
        : "",
    ),
    [category, setCategory] = useState(""),
    [tag, setTag] = useState(""),
    [difficulty, setDifficulty] = useState(
      /^[1-5]$/.test(search.get("difficulty") ?? "")
        ? search.get("difficulty")!
        : "",
    ),
    [favorites, setFavorites] = useState(false),
    [count, setCount] = useState("5"),
    [timed, setTimed] = useState(false),
    [minutes, setMinutes] = useState("15"),
    [validation, setValidation] = useState(""),
    [allHistory, setAllHistory] = useState(false);
  const startRequest = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    if (!requested || !snapshot || busy || routed.current === requested) return;
    routed.current = requested;
    const q = snapshot.questions.find(
      (q) => q.id === requested && q.module === module,
    );
    if (!q) {
      setValidation("QUESTION_NOT_FOUND");
      return;
    }
    const id = crypto.randomUUID();
    void run({
      kind: "start",
      id,
      date: snapshot.today,
      module,
      count: 1,
      minutes: null,
      filter: { questionId: q.id },
    }).then((next) => {
      if (next) setSelected(id);
    });
  }, [requested, snapshot, busy, module, run]);
  if (!snapshot)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"} className={error ? "error" : ""}>
          {error
            ? practiceError(error, t)
            : t("正在加载练习题…", "Loading practice questions…")}
        </p>
        {error && (
          <Button onClick={() => run({ kind: "ensure" })}>
            {t("重试", "Retry")}
          </Button>
        )}
      </section>
    );
  const questions = snapshot.questions.filter((q) => q.module === module);
  const attempts = snapshot.attempts.filter(
    (a) => a.question_snapshot.module === module,
  );
  const correct = attempts.filter((a) => a.is_correct).length;
  const sessions = [...snapshot.sessions]
    .filter((s) => s.module === module)
    .reverse();
  const active = sessions.find(
    (s) =>
      !s.ended_at &&
      s.local_date === snapshot.today &&
      s.timezone === settings.timezone &&
      (!s.deadline_at ||
        Date.parse(s.deadline_at) > Date.parse(snapshot.server_now)),
  );
  const selectedSession = snapshot.sessions.find((s) => s.id === selected);
  const filter: PracticeFilter = {
    ...(type ? { type: type as PracticeFilter["type"] } : {}),
    ...(category ? { category } : {}),
    ...(tag ? { tag } : {}),
    ...(difficulty ? { difficulty: Number(difficulty) } : {}),
    ...(favorites ? { favorites: true } : {}),
  };
  const matches = questions.filter(
    (q) =>
      (!type || q.type === type) &&
      (!category || q.category === category) &&
      (!tag || q.tags.includes(tag)) &&
      (!difficulty || q.difficulty === Number(difficulty)) &&
      (!favorites || snapshot.bookmarks.some((b) => b.question_id === q.id)),
  );
  async function start(q?: Question) {
    setValidation("");
    const budget = timed ? Number(minutes) : null;
    if (
      budget !== null &&
      (!Number.isInteger(budget) || budget < 1 || budget > 120)
    ) {
      setValidation("SESSION_SETTINGS");
      return;
    }
    const input = {
      kind: "start" as const,
      date: snapshot!.today,
      module,
      count: q ? 1 : Number(count),
      minutes: budget,
      filter: q ? { questionId: q.id } : filter,
    };
    const key = JSON.stringify(input);
    if (startRequest.current?.key !== key)
      startRequest.current = { key, id: crypto.randomUUID() };
    const result = await run({ ...input, id: startRequest.current.id });
    if (result) {
      setSelected(startRequest.current.id);
      startRequest.current = null;
    }
  }
  function reset() {
    setType("");
    setCategory("");
    setTag("");
    setDifficulty("");
    setFavorites(false);
    setValidation("");
  }
  const categoryName = (value: string) =>
    categoryLabels[value]
      ? t(...categoryLabels[value])
      : value.replaceAll("_", " ");
  return (
    <>
      <div className="dashboard-heading">
        <div className="page-heading">
          <div className="eyebrow">PRACTICE WITH PURPOSE</div>
          <h1>
            {module === "verbal"
              ? "Verbal Reasoning"
              : "Quantitative Reasoning"}
          </h1>
          <p className="muted">
            {module === "verbal"
              ? t(
                  "理解句子之间的逻辑，让每一次选择都有依据。",
                  "Follow the logic and make every choice with evidence.",
                )
              : t(
                  "拆解条件，写清步骤，让计算服务于推理。",
                  "Break down the conditions and make each step count.",
                )}
          </p>
        </div>
        <span className="practice-bank-label">
          {questions.length} {t("道原创示例", "original sample questions")}
        </span>
      </div>
      {(validation || error) && (
        <p className="error" role="alert">
          {practiceError(validation || error, t)}{" "}
          <button
            className="text-link inline"
            onClick={() => run({ kind: "ensure" })}
          >
            {t("刷新", "Refresh")}
          </button>
        </p>
      )}
      {selectedSession ? (
        <PracticeSessionView
          key={selectedSession.id}
          session={selectedSession}
          snapshot={snapshot}
          busy={busy}
          run={run}
          t={t}
          onBack={() => setSelected(null)}
          timezone={settings.timezone}
        />
      ) : (
        <>
          <div className="practice-overview">
            <section className="panel practice-setup">
              <div className="eyebrow">BUILD YOUR NEXT STUDY SET</div>
              <h2>
                {t("从一组专注练习开始。", "Start with one focused set.")}
              </h2>
              <p className="muted">
                {module === "verbal"
                  ? "Text Completion · Sentence Equivalence · Reading Comprehension"
                  : "Arithmetic · Algebra · Geometry · Data Analysis"}
              </p>
              {requested && (
                <div className="target-practice-note">
                  {t("当前从错题本定向进入。", "Opened from the mistake book.")}
                  <button onClick={() => setSearch({})}>
                    {t("取消定向练习", "Clear targeted practice")}
                  </button>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void start();
                }}
                noValidate
              >
                <div className="practice-filter-grid">
                  <label>
                    {t("题型", "Question type")}
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="">{t("全部题型", "All types")}</option>
                      {[...new Set(questions.map((q) => q.type))].map(
                        (value) => (
                          <option key={value} value={value}>
                            {t(...typeLabels[value])}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  {module === "quant" && (
                    <label>
                      {t("知识类别", "Knowledge category")}
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="">
                          {t("全部类别", "All categories")}
                        </option>
                        {[...new Set(questions.map((q) => q.category))].map(
                          (value) => (
                            <option key={value} value={value}>
                              {categoryName(value)}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                  <label>
                    {t("难度", "Difficulty")}
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="">{t("全部难度", "All levels")}</option>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option value={value} key={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("知识点", "Knowledge point")}
                    <select
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                    >
                      <option value="">
                        {t("全部知识点", "All knowledge points")}
                      </option>
                      {[...new Set(questions.flatMap((q) => q.tags))]
                        .sort()
                        .map((value) => (
                          <option key={value} value={value}>
                            {value.replaceAll("_", " ")}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t("每组题数", "Questions per set")}
                    <select
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                    >
                      {[1, 3, 5, 10, 20].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="practice-toggles">
                  <label>
                    <input
                      type="checkbox"
                      checked={favorites}
                      onChange={(e) => setFavorites(e.target.checked)}
                    />
                    {t("仅收藏题", "Favorites only")}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={timed}
                      onChange={(e) => setTimed(e.target.checked)}
                    />
                    {t("限时模式", "Timed mode")}
                  </label>
                  {timed && (
                    <label className="minute-input">
                      {t("限时分钟", "Time limit in minutes")}
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                      />
                    </label>
                  )}
                </div>
                <div className="practice-start-actions">
                  <Button type="submit" disabled={busy || matches.length === 0}>
                    {t("开始练习", "Start practice")}
                    <ArrowRight size={16} />
                  </Button>
                  {active && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setSelected(active.id)}
                    >
                      {t("继续上次练习", "Resume last set")}
                    </Button>
                  )}
                  <span>
                    {t(
                      `${matches.length} 道题可选，最多安排 ${Math.min(Number(count), matches.length)} 道`,
                      `${matches.length} available; up to ${Math.min(Number(count), matches.length)} in this set`,
                    )}
                  </span>
                </div>
                <small className="practice-setup-note">
                  {t(
                    "新建一组会结束本模块尚未完成的旧组，保留已提交答案。限时按经过时间计算，离开页面也会继续。",
                    "A new set ends an unfinished set in this module and keeps its saved answers. Timed mode includes time away from the page.",
                  )}
                </small>
              </form>
            </section>
            <aside className="panel practice-insights">
              <div className="section-title">
                <h2>{t("练习积累", "Your practice record")}</h2>
                <Target size={18} />
              </div>
              <div className="practice-insight">
                <span>{t("本模块已提交", "Answers in this module")}</span>
                <strong>{attempts.length}</strong>
              </div>
              <div className="practice-insight">
                <span>{t("累计正确率", "All-time accuracy")}</span>
                <strong>
                  {attempts.length
                    ? `${Math.round((correct / attempts.length) * 100)}%`
                    : "—"}
                </strong>
              </div>
              <p>
                {t(
                  "只统计实际提交的答案；手动完成任务和未作答题目不计入正确率。",
                  "Only submitted answers count. Manual task completion and unanswered questions do not affect accuracy.",
                )}
              </p>
              <div className="practice-insights-note">
                <BookOpen size={16} />
                {t(
                  "答错后自动进入错题本。",
                  "Wrong answers enter your mistake book automatically.",
                )}
              </div>
            </aside>
          </div>
          <section className="panel practice-library">
            <div className="section-title">
              <h2>{t("题目预览", "Question preview")}</h2>
              <Button variant="ghost" onClick={reset}>
                <RefreshCw size={14} />
                {t("重置筛选", "Reset filters")}
              </Button>
            </div>
            {matches.length ? (
              <div className="question-preview-grid">
                {matches.map((q) => (
                  <article key={q.id}>
                    <div>
                      <span>
                        {t(...typeLabels[q.type])} · {q.difficulty}/5
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        aria-label={`${snapshot.bookmarks.some((b) => b.question_id === q.id) ? t("取消收藏", "Unfavorite") : t("收藏", "Favorite")} ${q.id.slice(-3)}`}
                        aria-pressed={snapshot.bookmarks.some(
                          (b) => b.question_id === q.id,
                        )}
                        onClick={() =>
                          run({
                            kind: "favorite",
                            questionId: q.id,
                            value: !snapshot.bookmarks.some(
                              (b) => b.question_id === q.id,
                            ),
                          })
                        }
                      >
                        <Star
                          size={16}
                          fill={
                            snapshot.bookmarks.some(
                              (b) => b.question_id === q.id,
                            )
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </Button>
                    </div>
                    <p>
                      <MathText text={q.prompt} />
                    </p>
                    <div className="question-preview-bottom">
                      <span>
                        {q.tags
                          .slice(0, 2)
                          .map((tag) => tag.replaceAll("_", " "))
                          .join(" · ")}
                      </span>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => start(q)}
                      >
                        {t("练这一题", "Practice this question")}
                        <ArrowRight size={14} />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="practice-empty">
                <BookOpen size={28} />
                <h3>
                  {t("此筛选下没有题目", "No questions match these filters")}
                </h3>
                <p>
                  {questions.length
                    ? t(
                        "调整筛选条件后再试。",
                        "Adjust the filters and try again.",
                      )
                    : t(
                        "请按指南执行 questions-seed.sql，或由管理员审核题库内容。",
                        "Apply questions-seed.sql or have the content reviewed by an administrator.",
                      )}
                </p>
              </div>
            )}
          </section>
          <section className="panel session-history">
            <div className="section-title">
              <h2>{t("最近练习组", "Recent practice sets")}</h2>
              <Clock size={18} />
            </div>
            {sessions.length ? (
              <>
                <div className="session-history-list">
                  {sessions.slice(0, allHistory ? undefined : 5).map((s) => {
                    const a = snapshot.attempts.filter(
                      (a) => a.session_id === s.id,
                    );
                    return (
                      <div key={s.id}>
                        <div>
                          <strong>{s.local_date}</strong>
                          <small>
                            {a.length} / {s.question_ids.length}{" "}
                            {t("题已提交", "submitted")} ·{" "}
                            {s.deadline_at
                              ? t("限时", "timed")
                              : t("不限时", "untimed")}
                          </small>
                        </div>
                        <span>
                          {a.length
                            ? `${a.filter((a) => a.is_correct).length}/${a.length}`
                            : "—"}
                        </span>
                        <Button
                          variant="outline"
                          onClick={() => setSelected(s.id)}
                        >
                          {s.ended_at
                            ? t("查看记录", "View record")
                            : t("继续 / 查看", "Resume / view")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {sessions.length > 5 && (
                  <Button
                    variant="ghost"
                    onClick={() => setAllHistory((value) => !value)}
                  >
                    {allHistory
                      ? t("收起历史", "Show less")
                      : t("显示全部历史", "Show all history")}
                  </Button>
                )}
              </>
            ) : (
              <p className="muted history-empty">
                {t(
                  "还没有练习组。开始第一组后，记录会保留在这里。",
                  "No practice sets yet. Your first set will appear here.",
                )}
              </p>
            )}
          </section>
        </>
      )}
      <p className="practice-footnote">
        {t(
          "原创 AI 辅助示例题，经作者校核与判题测试，未经独立语言专家审定；非 ETS 官方题目或评分。",
          "Original AI-assisted samples, author-checked and tested; not independently certified by a subject expert or ETS.",
        )}
      </p>
    </>
  );
}

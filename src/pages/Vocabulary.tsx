import { useEffect, useState } from "react";
import {
  BookOpen,
  Clock,
  Star,
  Search,
  Upload,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useAuth } from "../features/auth/AuthProvider";
import { useVocabulary } from "../hooks/useVocabulary";
import { studyQueue, isDue } from "../algorithms/vocabulary";
import { StudySession } from "../features/vocabulary/StudySession";
import { ImportDialog } from "../features/vocabulary/ImportDialog";
import { WordDialog } from "../features/vocabulary/WordDialog";
import {
  statusLabels,
  vocabError,
  type Translate,
} from "../features/vocabulary/shared";
import type { StudySettings } from "../types";
import type { Word } from "../types/vocabulary";
export function Vocabulary({
  settings,
  t,
}: {
  settings: StudySettings;
  t: Translate;
}) {
  const { user } = useAuth();
  const { snapshot, busy, error, run } = useVocabulary(user?.id);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [mode, setMode] = useState<"card" | "spelling" | "choice">("card"),
    [queue, setQueue] = useState<"daily" | "review" | "new">("daily");
  const [session, setSession] = useState<{
    ids: string[];
    mode: typeof mode;
    date: string;
    key: string;
  } | null>(null);
  const [importing, setImporting] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [limit, setLimit] = useState(24);
  useEffect(() => {
    if (snapshot && session && session.date !== snapshot.today)
      setSession(null);
  }, [snapshot, session]);
  if (!snapshot)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"} className={error ? "error" : ""}>
          {error
            ? vocabError(error, t)
            : t("正在加载词库…", "Loading your vocabulary…")}
        </p>
        {error && (
          <Button onClick={() => run({ kind: "ensure" })}>
            {t("重试", "Retry")}
          </Button>
        )}
      </section>
    );
  const due = snapshot.words.filter((w) =>
    isDue(
      snapshot.progress.find((p) => p.vocabulary_id === w.id),
      snapshot.today,
    ),
  ).length;
  const newToday = new Set(
    snapshot.reviews
      .filter((r) => r.local_date === snapshot.today && r.kind === "new")
      .map((r) => r.vocabulary_id),
  ).size;
  const wrongIds = new Set(
    snapshot.reviews.filter((r) => !r.correct).map((r) => r.vocabulary_id),
  );
  const favorites = snapshot.progress.filter((p) => p.favorite).length;
  const mastered = snapshot.progress.filter(
    (p) => p.status === "mastered",
  ).length;
  const filtered = snapshot.words.filter((word) => {
    const p = snapshot.progress.find((p) => p.vocabulary_id === word.id),
      status = p?.status ?? "new";
    const matches = [
      word.word,
      word.definition_en,
      word.definition_zh,
      ...word.tags,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase().trim());
    return (
      matches &&
      (filter === "all" ||
        (filter === "favorite" && p?.favorite) ||
        (filter === "wrong" && wrongIds.has(word.id)) ||
        (filter === "due" && isDue(p, snapshot.today)) ||
        filter === status)
    );
  });
  const planned = studyQueue(snapshot, snapshot.new_word_target, queue);
  const detail = snapshot.words.find((w) => w.id === selected);
  function start(words: Word[]) {
    setSelected(null);
    setSession({
      ids: words.map((w) => w.id),
      mode,
      date: snapshot!.today,
      key: crypto.randomUUID(),
    });
  }
  return (
    <>
      <div className="dashboard-heading vocab-heading">
        <div className="page-heading">
          <div className="eyebrow">LESS CRAMMING. MORE REMEMBERING.</div>
          <h1>
            {t(
              "让每一个单词，慢慢变熟悉。",
              "Make every word a little more familiar.",
            )}
          </h1>
          <p className="muted">
            {t(
              "先回想，再翻面。按记忆情况安排下一次见面。",
              "Recall before revealing. Let your memory guide the next review.",
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setImporting(true)}
          disabled={busy}
        >
          <Upload size={15} />
          {t("导入 CSV", "Import CSV")}
        </Button>
      </div>
      <div className="vocab-stats">
        {[
          { icon: Clock, label: t("到期复习", "Due for review"), value: due },
          {
            icon: BookOpen,
            label: t("今日新词", "New words today"),
            value: `${newToday} / ${snapshot.new_word_target}`,
          },
          {
            icon: CheckCircle2,
            label: t("已掌握", "Mastered"),
            value: mastered,
          },
          { icon: Star, label: t("已收藏", "Favorites"), value: favorites },
        ].map((item) => (
          <section className="panel vocab-stat" key={item.label}>
            <item.icon size={18} />
            <div>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          </section>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {vocabError(error, t)}
        </p>
      )}
      {due > 0 && !session && (
        <div className="review-reminder">
          <Clock size={18} />
          <span>
            {t(
              `有 ${due} 个单词到期，建议先复习。`,
              `You have ${due} due words. Review them first.`,
            )}
          </span>
          <button
            onClick={() => {
              setQueue("review");
              setFilter("due");
            }}
          >
            {t("查看到期词", "See due words")}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      {session ? (
        <StudySession
          key={session.key}
          ids={session.ids}
          mode={session.mode}
          date={session.date}
          snapshot={snapshot}
          run={run}
          busy={busy}
          t={t}
          onClose={() => setSession(null)}
        />
      ) : (
        <>
          <section className="vocabulary-start panel">
            <div>
              <div className="eyebrow">YOUR DAILY WORD PRACTICE</div>
              <h2>{t("为记忆留一点间隔。", "Give memory a little space.")}</h2>
              <p className="muted">
                {t(
                  "到期词优先，按每日新词目标补充。额外练习不会提前推高间隔。",
                  "Due words come first, followed by your daily new-word allowance. Extra correct practice keeps the due date.",
                )}
              </p>
            </div>
            {snapshot.new_word_target !== settings.new_words && (
              <p className="panel-description">
                {t(
                  `今日计划 ${snapshot.new_word_target} 词，设置目标 ${settings.new_words} 词。可在工作台重排今日计划。`,
                  `Today's plan is ${snapshot.new_word_target} words; your preference is ${settings.new_words}. Replan from the dashboard to adjust.`,
                )}
              </p>
            )}
            <div className="start-controls">
              <label>
                {t("学习范围", "Study queue")}
                <select
                  value={queue}
                  onChange={(e) => setQueue(e.target.value as typeof queue)}
                >
                  <option value="daily">
                    {t("今日计划", "Today’s queue")}
                  </option>
                  <option value="review">{t("到期复习", "Due reviews")}</option>
                  <option value="new">{t("今日新词", "New words")}</option>
                </select>
              </label>
              <label>
                {t("学习方式", "Practice mode")}
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                >
                  <option value="card">{t("词汇卡片", "Flashcards")}</option>
                  <option value="spelling">
                    {t("拼写测试", "Spelling test")}
                  </option>
                  <option value="choice">
                    {t("释义选择", "Meaning quiz")}
                  </option>
                </select>
              </label>
              <Button
                disabled={busy || !planned.length}
                onClick={() => start(planned)}
              >
                {t("开始今日学习", "Start daily practice")}
                <ArrowRight size={16} />
              </Button>
            </div>
            {!planned.length && (
              <p className="queue-empty">
                {snapshot.words.length
                  ? t(
                      "这组没有待学单词。已完成新词目标时，可浏览词库进行额外练习。",
                      "Nothing is due in this queue. Browse a word below for extra practice.",
                    )
                  : t(
                      "云端词库为空。请执行 seed.sql，或导入已审核的个人 CSV。",
                      "Your cloud library is empty. Apply seed.sql or import reviewed personal vocabulary.",
                    )}
              </p>
            )}
          </section>
          <section className="panel vocabulary-library">
            <div className="section-title">
              <h2>{t("我的词库", "My word library")}</h2>
              <span className="subtle-chip">{snapshot.words.length} WORDS</span>
            </div>
            <div className="vocab-filters">
              <label className="search-field">
                <Search size={16} />
                <span className="sr-only">
                  {t("搜索词汇", "Search vocabulary")}
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLimit(24);
                  }}
                  placeholder={t(
                    "搜索单词、中文释义或标签",
                    "Search words, meanings or tags",
                  )}
                />
              </label>
              <label>
                <span className="sr-only">
                  {t("按掌握程度筛选", "Filter learning status")}
                </span>
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setLimit(24);
                  }}
                >
                  <option value="all">{t("全部词汇", "All words")}</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(label[0], label[1])}
                    </option>
                  ))}
                  <option value="due">{t("到期复习", "Due reviews")}</option>
                  <option value="favorite">{t("已收藏", "Favorites")}</option>
                  <option value="wrong">
                    {t("错词记录", "Wrong-word history")}
                  </option>
                </select>
              </label>
            </div>
            {filtered.length ? (
              <div className="word-grid">
                {filtered.slice(0, limit).map((word) => {
                  const p = snapshot.progress.find(
                    (p) => p.vocabulary_id === word.id,
                  );
                  return (
                    <article className="word-tile" key={word.id}>
                      <div>
                        <span className={`status-pill ${p?.status ?? "new"}`}>
                          {t(
                            statusLabels[p?.status ?? "new"][0],
                            statusLabels[p?.status ?? "new"][1],
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          aria-label={`${p?.favorite ? t("取消收藏", "Unfavorite") : t("收藏", "Favorite")} ${word.word}`}
                          aria-pressed={!!p?.favorite}
                          onClick={() =>
                            run({
                              kind: "favorite",
                              wordId: word.id,
                              value: !p?.favorite,
                            })
                          }
                        >
                          <Star
                            size={15}
                            fill={p?.favorite ? "currentColor" : "none"}
                          />
                        </Button>
                      </div>
                      <button
                        className="word-open"
                        onClick={() => setSelected(word.id)}
                      >
                        <strong>{word.word}</strong>
                        <span>
                          {word.ipa} · {word.part_of_speech}
                        </span>
                        <p>{word.definition_zh}</p>
                      </button>
                      <div className="word-tile-footer">
                        <small>
                          {p?.due_date
                            ? `${t("复习", "Due")} ${p.due_date}`
                            : t("等待第一次学习", "Ready for a first review")}
                        </small>
                        <span>
                          {word.owner_id
                            ? t("个人", "Private")
                            : t("原创", "Original")}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="vocab-empty">
                <Search size={26} />
                <h3>{t("没有匹配的单词", "No matching words")}</h3>
                <p>
                  {t(
                    "试试其他关键词或筛选条件。",
                    "Try another search or filter.",
                  )}
                </p>
              </div>
            )}
            {filtered.length > limit && (
              <Button variant="outline" onClick={() => setLimit((v) => v + 24)}>
                {t("显示更多", "Show more")}
              </Button>
            )}
          </section>
          {filter === "wrong" && (
            <section className="panel wrong-word-panel">
              <div className="section-title">
                <h2>{t("错词回顾", "Review wrong words")}</h2>
                <AlertCircle size={18} />
              </div>
              {filtered
                .filter((w) => wrongIds.has(w.id))
                .sort(
                  (a, b) =>
                    snapshot.reviews.filter(
                      (r) => r.vocabulary_id === b.id && !r.correct,
                    ).length -
                    snapshot.reviews.filter(
                      (r) => r.vocabulary_id === a.id && !r.correct,
                    ).length,
                )
                .map((word) => {
                  const errors = snapshot.reviews.filter(
                      (r) => r.vocabulary_id === word.id && !r.correct,
                    ),
                    last = errors[errors.length - 1];
                  const original =
                    last.mode === "choice"
                      ? (snapshot.words.find((w) => w.id === last.answer)
                          ?.definition_zh ?? last.answer)
                      : last.mode === "card"
                        ? t("自评：未想起", "Self-rating: forgot")
                        : last.answer;
                  return (
                    <div className="wrong-word-row" key={word.id}>
                      <div>
                        <strong>{word.word}</strong>
                        <span>
                          {t(
                            `累计 ${errors.length} 次`,
                            `${errors.length} errors`,
                          )}
                        </span>
                        <p>
                          {t("原错误答案", "Last wrong answer")}: {original}
                        </p>
                        <p>
                          {t("正确拼写与词义", "Correct spelling and meaning")}:{" "}
                          {word.word} — {word.definition_zh}
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => start([word])}>
                        {t("重新练习", "Practice again")}
                      </Button>
                    </div>
                  );
                })}
              {!filtered.length && (
                <p className="muted">
                  {t("没有匹配的错词。", "No matching wrong words.")}
                </p>
              )}
            </section>
          )}
        </>
      )}
      {detail && (
        <WordDialog
          word={detail}
          progress={snapshot.progress.find(
            (p) => p.vocabulary_id === detail.id,
          )}
          t={t}
          run={run}
          busy={busy}
          onClose={() => setSelected(null)}
          onPractice={() => start([detail])}
        />
      )}

      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          run={run}
          busy={busy}
          t={t}
          remoteError={error}
        />
      )}
      <p className="vocab-footnote">
        {t(
          "使用 SM-2 变体安排复习；卡片为自评，测验使用确定性答案。发音取决于浏览器英语语音。",
          "Reviews use an SM-2 variant. Cards are self-rated; quizzes use deterministic answers. Audio depends on your browser English voices.",
        )}
      </p>
    </>
  );
}

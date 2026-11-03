import { useState } from "react";
import { PenLine, Plus } from "lucide-react";
import { useAuth } from "../features/auth/AuthProvider";
import { useWriting } from "../hooks/useWriting";
import { writingAction } from "../services/writing";
import { issuePrompts } from "../data/writing";
import { WritingEditor } from "../features/writing/Editor";
import { Button } from "../components/ui/button";
import type { Translate } from "../features/study/shared";
import { readWritingRecovery } from "../services/writingRecovery";
export function Writing({ t }: { t: Translate }) {
  const { user } = useAuth(),
    { snapshot, setSnapshot, error, setError } = useWriting(user?.id);
  const [prompt, setPrompt] = useState<string>(issuePrompts[0].id),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const documents = snapshot?.documents ?? [],
    current =
      documents.find((d) => d.id === selected) ??
      (selected === null
        ? documents.find((d) => readWritingRecovery(d, user?.id))
        : undefined);
  async function start() {
    setBusy(true);
    setError("");
    const id = crypto.randomUUID();
    try {
      const next = await writingAction(
        { kind: "start", id, promptId: prompt },
        user?.id,
      );
      setSnapshot(next);
      setSelected(id);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">THINK CLEARLY, WRITE WITH PURPOSE</div>
        <h1>Analytical Writing</h1>
        <p className="muted">
          {t(
            "从一个立场出发，把理由写清楚。",
            "Take a position. Make your reasons clear.",
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="error">
          {t(
            "无法加载或创建作文，请重试。",
            "Could not load or create an essay. Retry.",
          )}{" "}
          <Button
            variant="outline"
            onClick={() => {
              void writingAction({ kind: "ensure" }, user?.id)
                .then(setSnapshot)
                .catch((e) => setError(String(e)));
            }}
          >
            {t("重试", "Retry")}
          </Button>
        </p>
      )}
      {!snapshot && !error ? (
        <p role="status">{t("正在加载作文…", "Loading essays…")}</p>
      ) : (
        <>
          <section className="panel writing-start">
            <div>
              <h2>{t("Analyze an Issue 练习", "Analyze an Issue practice")}</h2>
              <p className="muted small">
                {t(
                  "4 道原创示例题 · 自动保存 · 30 分钟计时",
                  "4 original sample prompts · Autosave · 30-minute timer",
                )}
              </p>
            </div>
            <label>
              {t("选择写作题目", "Choose a writing prompt")}
              <select
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              >
                {issuePrompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={busy || dirty} onClick={() => void start()}>
              <Plus size={16} />
              {t("开始新作文", "Start new essay")}
            </Button>
          </section>
          {current ? (
            <WritingEditor
              key={current.id}
              doc={current}
              serverNow={snapshot!.server_now}
              userId={user?.id}
              t={t}
              onSaved={(next) => {
                setSnapshot(next);
                setSelected(current.id);
              }}
              onDirty={setDirty}
            />
          ) : (
            <section className="panel empty-state">
              <PenLine size={30} />
              <h2>
                {t(
                  "为下一篇论证留一个位置",
                  "Make room for your next argument",
                )}
              </h2>
              <p>
                {t(
                  "选择题目开始，或从下方继续已有草稿。",
                  "Choose a prompt to start, or continue a draft below.",
                )}
              </p>
            </section>
          )}
          <section className="panel writing-history">
            <div className="section-head">
              <h2>{t("草稿与历史作文", "Drafts and essay history")}</h2>
              <span className="muted">{documents.length}</span>
            </div>
            {!documents.length ? (
              <p className="muted">
                {t("还没有写作记录。", "No writing records yet.")}
              </p>
            ) : (
              <div className="essay-list">
                {[...documents].reverse().map((d) => (
                  <button
                    className="essay-row"
                    key={d.id}
                    disabled={dirty}
                    aria-pressed={selected === d.id}
                    onClick={() => {
                      setDirty(false);
                      setSelected(d.id);
                    }}
                  >
                    <span>
                      <strong>
                        {issuePrompts.find((p) => p.id === d.prompt_id)
                          ?.title ?? "Issue essay"}
                      </strong>
                      <span className="muted small">
                        {d.local_date} ·{" "}
                        {d.completed_at
                          ? t("已完成", "Completed")
                          : t("草稿", "Draft")}
                      </span>
                    </span>
                    <span>{t("打开作文", "Open essay")} →</span>
                  </button>
                ))}
              </div>
            )}
            <p className="small muted">
              {t(
                "有未保存修改时，先保存再切换作文。原创 AI 辅助题目，作者校核，非官方题库。",
                "Save pending changes before switching essays. Original AI-assisted, author-reviewed prompts; not an official question bank.",
              )}
            </p>
          </section>
        </>
      )}
    </>
  );
}

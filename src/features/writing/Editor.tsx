import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Save, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { writingAction, requestWritingFeedback } from "../../services/writing";
import { wordCount } from "../../algorithms/writing";
import type { WritingDocument, WritingSnapshot } from "../../types/writing";
import type { Translate } from "../study/shared";
import {
  readWritingRecovery,
  saveWritingRecovery,
  clearWritingRecovery,
} from "../../services/writingRecovery";
export function WritingEditor({
  doc,
  serverNow,
  userId,
  t,
  onSaved,
  onDirty,
}: {
  doc: WritingDocument;
  serverNow: string;
  userId?: string;
  t: Translate;
  onSaved: (s: WritingSnapshot) => void;
  onDirty: (v: boolean) => void;
}) {
  const [recovery] = useState(() => readWritingRecovery(doc, userId));
  const [body, setBody] = useState(recovery?.body ?? doc.body),
    [notes, setNotes] = useState(recovery?.notes ?? doc.notes),
    [saved, setSaved] = useState({ body: doc.body, notes: doc.notes }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(
      recovery && recovery.revision !== doc.revision ? "STALE_REVISION" : "",
    ),
    [notice, setNotice] = useState(
      recovery
        ? t(
            "已恢复本标签页未保存的文字，请核对后保存。",
            "Recovered unsaved text from this tab. Review and save it.",
          )
        : "",
    ),
    [now, setNow] = useState(Date.now()),
    [aiBusy, setAiBusy] = useState(false);
  const revision = useRef(recovery?.revision ?? doc.revision),
    inFlight = useRef(false),
    request = useRef<{ key: string; id: string } | null>(null),
    savedCallback = useRef(onSaved),
    dirtyCallback = useRef(onDirty);
  savedCallback.current = onSaved;
  dirtyCallback.current = onDirty;
  const latest = useRef({ body, notes });
  latest.current = { body, notes };
  function buffer(nextBody: string, nextNotes: string) {
    if (
      !saveWritingRecovery(
        doc.id,
        { body: nextBody, notes: nextNotes, revision: revision.current },
        userId,
      )
    )
      setNotice(
        t(
          "临时备份不可用，请保存或导出当前文字。",
          "Temporary backup is unavailable. Save or export your text.",
        ),
      );
  }
  const offset = useRef(Date.parse(serverNow) - Date.now());
  const dirty = body !== saved.body || notes !== saved.notes;
  const [finished, setFinished] = useState(!!doc.completed_at);
  useEffect(() => {
    dirtyCallback.current(dirty);
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", unload);
    const guardNavigation = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        dirty &&
        anchor &&
        anchor.origin === window.location.origin &&
        anchor.href !== window.location.href
      ) {
        e.preventDefault();
        e.stopPropagation();
        setNotice(
          t(
            "请先保存修改，再离开本篇作文。",
            "Save your changes before leaving this essay.",
          ),
        );
      }
    };
    document.addEventListener("click", guardNavigation, true);
    // Internal links are held briefly while autosave runs. Browser unload uses its native prompt.
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [dirty, t]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const save = useCallback(
    async (kind: "save" | "finish") => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      setNotice("");
      const key = JSON.stringify([kind, revision.current, body, notes]);
      if (request.current?.key !== key)
        request.current = { key, id: crypto.randomUUID() };
      try {
        const next = await writingAction(
            {
              kind,
              id: doc.id,
              requestId: request.current.id,
              revision: revision.current,
              body,
              notes,
            },
            userId,
          ),
          updated = next.documents.find((d) => d.id === doc.id)!;
        revision.current = updated.revision;
        if (latest.current.body === body && latest.current.notes === notes)
          clearWritingRecovery(doc.id, userId);
        else
          saveWritingRecovery(
            doc.id,
            { ...latest.current, revision: updated.revision },
            userId,
          );
        setSaved({ body, notes });
        setFinished(!!updated.completed_at);
        savedCallback.current(next);
        setNotice(
          kind === "finish"
            ? t(
                "作文已完成，已加入历史记录。",
                "Essay completed and added to history.",
              )
            : t("草稿已保存", "Draft saved"),
        );
      } catch (e) {
        setError(String(e));
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [body, notes, doc.id, userId, t],
  );
  useEffect(() => {
    if (!dirty || busy || error) return;
    const timer = setTimeout(() => void save("save"), 800);
    return () => clearTimeout(timer);
  }, [dirty, busy, error, save]);
  const seconds = Math.max(
    0,
    Math.ceil((Date.parse(doc.deadline_at) - (now + offset.current)) / 1000),
  );
  const aiConfigured =
    import.meta.env.VITE_ENABLE_WRITING_AI === "true" && !!userId;
  const reload = () => {
    clearWritingRecovery(doc.id, userId);
    setBody(doc.body);
    setNotes(doc.notes);
    setSaved({ body: doc.body, notes: doc.notes });
    revision.current = doc.revision;
    setError("");
    setNotice(t("已载入保存版本", "Saved version loaded"));
  };
  async function feedback() {
    setAiBusy(true);
    setError("");
    try {
      await requestWritingFeedback(doc.id);
      savedCallback.current(await writingAction({ kind: "ensure" }, userId));
      setNotice(t("AI 学习建议已保存", "AI study feedback saved"));
    } catch (e) {
      setError(String(e));
    } finally {
      setAiBusy(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([doc.prompt + "\n\n" + body + "\n\nRevision notes:\n" + notes], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `gre-pilot-${doc.local_date}-${doc.id.slice(-6)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="writing-grid">
      <section className="panel writing-editor">
        <div className="section-head">
          <h2>
            {finished
              ? t("历史作文", "Completed essay")
              : t("写作草稿", "Essay draft")}
          </h2>
          <span
            className="writing-clock"
            role="timer"
            aria-label={t("剩余写作时间", "Writing time remaining")}
          >
            <Clock size={17} />
            {Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}
            :{(seconds % 60).toString().padStart(2, "0")}
          </span>
        </div>
        <p className="muted small">
          {doc.local_date} · {doc.timezone} ·{" "}
          {t("30 分钟练习", "30-minute practice")}
        </p>
        {!seconds && !finished && (
          <p role="status" className="notice">
            {t(
              "时间已到。可保存收尾，超时文字也会保留；这是练习计时器。",
              "Time is up. You can save your concluding edits; overtime text is retained in this practice timer.",
            )}
          </p>
        )}
        <div className="issue-prompt" lang="en">
          {doc.prompt}
        </div>
        <label className="writing-field">
          {t("作文正文（英文）", "Essay body (English)")}
          <textarea
            lang="en"
            spellCheck
            value={body}
            readOnly={finished}
            maxLength={60000}
            rows={18}
            onChange={(e) => {
              setBody(e.target.value);
              setError("");
              setNotice("");
              buffer(e.target.value, notes);
            }}
          />
        </label>
        <div className="section-head">
          <span data-testid="word-count">
            {wordCount(body)} {t("词", "words")}
          </span>
          <span className="muted small" role="status">
            {busy
              ? t("正在保存…", "Saving…")
              : dirty
                ? notice || t("有未保存修改", "Unsaved changes")
                : notice || t("已保存", "Saved")}
          </span>
        </div>
        <label className="writing-field">
          {t("自行记录修改意见", "Your revision notes")}
          <textarea
            rows={4}
            maxLength={10000}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setError("");
              setNotice("");
              buffer(body, e.target.value);
            }}
          />
        </label>
        {error && (
          <div role="alert" className="error">
            {error.includes("STALE_REVISION")
              ? t(
                  "另一标签页已更新这篇作文。当前文字仍保留；先导出，再载入保存版本后合并。",
                  "Another tab updated this essay. Your text is retained. Export it, then load the saved version to merge.",
                )
              : t(
                  "保存或反馈失败，当前文字仍保留。请重试；AI 需服务端配置并有调用次数限制。",
                  "Save or feedback failed; your text is retained. Retry. AI requires server setup and has usage limits.",
                )}
            <Button variant="outline" onClick={reload}>
              {t(
                "载入已保存版本（替换当前文字）",
                "Load saved version (replace current text)",
              )}
            </Button>
          </div>
        )}
        <div className="writing-actions">
          <Button
            variant="outline"
            disabled={busy || !dirty}
            onClick={() => void save("save")}
          >
            <Save size={16} />
            {t("保存草稿", "Save draft")}
          </Button>
          <Button variant="outline" onClick={download}>
            <Download size={16} />
            {t("导出文本", "Export text")}
          </Button>
          {!finished && (
            <Button
              disabled={busy || wordCount(body) < 1}
              onClick={() => void save("finish")}
            >
              {t("完成本篇写作", "Complete essay")}
            </Button>
          )}
        </div>
      </section>
      <aside className="writing-aside">
        <section className="panel">
          <h2>{t("搭建论证结构", "Build your argument")}</h2>
          <ol className="writing-tips">
            <li>
              {t("明确立场与适用条件。", "State your position and its limits.")}
            </li>
            <li>
              {t(
                "每段提出理由，再用具体例子说明。",
                "Give a reason in each paragraph and support it with a concrete example.",
              )}
            </li>
            <li>
              {t(
                "回应有力的反例或相反观点。",
                "Address a strong counterexample or opposing view.",
              )}
            </li>
            <li>
              {t(
                "检查因果跳跃、概括和段落衔接。",
                "Check causal leaps, generalizations and transitions.",
              )}
            </li>
          </ol>
          <p className="small muted">
            {t(
              "提示用于组织思路，不是固定作文模板。字数按英文词元估算，不构成评分。",
              "These prompts help organize ideas. Word count is an English-token estimate, not a score.",
            )}
          </p>
        </section>
        <section className="panel">
          <h2>
            AI Feedback{" "}
            <span className="small muted">{t("可选", "Optional")}</span>
          </h2>
          <p className="muted">
            {t(
              "分析论证、逻辑、表达、语法并提出改写建议。不是 ETS 官方评分。",
              "Review argument, logic, expression and grammar with revision suggestions. This is not an ETS score.",
            )}
          </p>
          <p className="small">
            {aiConfigured
              ? t(
                  "点击后，已完成的作文正文与题目将发送到已配置的反馈服务。每天最多 3 次，失败请求也占一次。",
                  "On request, the completed essay and prompt are sent to the configured feedback service. Maximum 3 requests per day; failed requests also count.",
                )
              : t(
                  "AI 尚未启用。写作、保存和计时可直接使用。",
                  "AI is not enabled. Writing, saving and timing work independently.",
                )}
          </p>
          <Button
            variant="outline"
            disabled={!aiConfigured || !finished || dirty || busy || aiBusy}
            onClick={() => void feedback()}
          >
            {aiBusy
              ? t("正在获取建议…", "Requesting feedback…")
              : t("获取 AI 学习建议", "Request AI study feedback")}
          </Button>
          {doc.ai_feedback &&
            Object.entries(doc.ai_feedback).map(([key, value]) => (
              <div className="feedback-section" key={key}>
                <h3>
                  {
                    {
                      structure: t("结构", "Structure"),
                      logic: t("逻辑", "Logic"),
                      language: t("表达", "Language"),
                      grammar: t("语法", "Grammar"),
                      revision: t("修改建议", "Revision suggestions"),
                    }[key]
                  }
                </h3>
                <p className="prewrap">{value}</p>
              </div>
            ))}
        </section>
      </aside>
    </div>
  );
}

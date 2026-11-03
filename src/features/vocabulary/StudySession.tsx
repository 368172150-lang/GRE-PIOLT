import { useRef, useState } from "react";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Definition, WordDetails } from "./WordDetails";
import { choiceOptions } from "../../algorithms/vocabulary";
import type { Word, VocabSnapshot, ReviewEvent } from "../../types/vocabulary";
import type { Translate, VocabRunner } from "./shared";
export function StudySession({
  ids,
  mode,
  date,
  snapshot,
  run,
  busy,
  t,
  onClose,
}: {
  ids: string[];
  mode: "card" | "spelling" | "choice";
  date: string;
  snapshot: VocabSnapshot;
  run: VocabRunner;
  busy: boolean;
  t: Translate;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [answer, setAnswer] = useState(""),
    [result, setResult] = useState<ReviewEvent | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);
  const word = snapshot.words.find((w) => w.id === ids[index]);
  if (!word)
    return (
      <section className="panel session-complete">
        <div className="empty-icon">
          <RotateCcw size={24} />
        </div>
        <h2>{t("这一组学习已完成", "This study set is complete")}</h2>
        <p className="muted">
          {t(
            "记录已保存。按计划间隔复习，比立即重复刷词更有效。",
            "Your progress is saved. Return when the words are due again.",
          )}
        </p>
        <Button onClick={onClose}>
          {t("返回词库", "Back to library")}
          <ArrowRight size={16} />
        </Button>
      </section>
    );
  const progress = snapshot.progress.find((p) => p.vocabulary_id === word.id);
  const options = choiceOptions(snapshot.words, word);
  async function submit(value: string, quality?: number) {
    if (!word) return;
    const input = {
      kind: "review" as const,
      date,
      wordId: word.id,
      revision: progress?.revision ?? 0,
      mode,
      answer: value,
      ...(quality !== undefined ? { quality } : {}),
    };
    const key = JSON.stringify(input);
    if (request.current?.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    const next = await run({ ...input, id: request.current.id });
    if (next) {
      const saved = next.reviews.find((r) => r.id === request.current!.id);
      if (saved) setResult(saved);
    }
  }
  function next() {
    setIndex((i) => i + 1);
    setFlipped(false);
    setAnswer("");
    setResult(null);
    request.current = null;
  }
  return (
    <section className="panel learning-session">
      <div className="session-top">
        <span>
          {mode === "card"
            ? t("词汇卡片", "Flashcards")
            : mode === "spelling"
              ? t("拼写测试", "Spelling test")
              : t("释义选择", "Meaning quiz")}{" "}
          · {index + 1} / {ids.length}
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("结束本组学习", "End study set")}
          onClick={onClose}
          disabled={busy}
        >
          <X size={18} />
        </Button>
      </div>
      <div className="session-track">
        <span style={{ width: `${(index / ids.length) * 100}%` }} />
      </div>
      <WordDetails
        word={word}
        progress={progress}
        t={t}
        busy={busy}
        run={run}
        hideWord={mode === "spelling" && !result}
      />
      {mode === "card" ? (
        <>
          {flipped || result ? (
            <Definition word={word} t={t} />
          ) : (
            <button className="flip-area" onClick={() => setFlipped(true)}>
              <RotateCcw size={25} />
              <strong>
                {t("回想词义，然后翻面", "Recall the meaning, then flip")}
              </strong>
              <span>
                {t(
                  "点击，或用 Tab 后按 Enter / 空格",
                  "Click, or use Tab then Enter / Space",
                )}
              </span>
            </button>
          )}
          {flipped && !result && (
            <div
              className="quality-controls"
              aria-label={t("评价掌握情况", "Rate your recall")}
            >
              {[
                { q: 0, zh: "忘记了", en: "Forgot" },
                { q: 3, zh: "较吃力", en: "Hard" },
                { q: 4, zh: "记得", en: "Good" },
                { q: 5, zh: "很熟练", en: "Easy" },
              ].map((item) => (
                <Button
                  key={item.q}
                  variant="outline"
                  disabled={busy}
                  onClick={() => submit(`self-rating:${item.q}`, item.q)}
                >
                  {t(item.zh, item.en)}
                </Button>
              ))}
            </div>
          )}
          {!flipped && !result && (
            <Button variant="outline" onClick={() => setFlipped(true)}>
              {t("翻转卡片", "Flip card")}
            </Button>
          )}
        </>
      ) : mode === "spelling" ? (
        <>
          <p className="spelling-prompt">{word.definition_zh}</p>
          <p className="muted">
            {t(
              "请输入对应的英语单词。",
              "Type the English word for this meaning.",
            )}
          </p>
          <form
            className="spelling-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(answer);
            }}
          >
            <label className="sr-only" htmlFor="spelling-answer">
              {t("单词拼写", "Spell the word")}
            </label>
            <input
              id="spelling-answer"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={answer}
              maxLength={1500}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={busy || !!result}
              autoFocus
            />
            <Button type="submit" disabled={busy || !!result || !answer.trim()}>
              {t("提交答案", "Submit answer")}
            </Button>
          </form>
        </>
      ) : (
        <>
          <p className="muted">
            {t(
              "选择这个单词的中文释义。",
              "Choose the Chinese meaning of this word.",
            )}
          </p>
          <div className="choice-grid">
            {options.length < 2 ? (
              <p role="status" className="muted">
                {t(
                  "词库缺少不同释义的备选项。请结束本组，改用卡片或拼写。",
                  "There are not enough distinct meanings for choices. End this set and use flashcards or spelling.",
                )}
              </p>
            ) : (
              options.map((option: Word, i) => (
                <Button
                  key={option.id}
                  variant="outline"
                  disabled={busy || !!result}
                  className={
                    result
                      ? option.id === word.id
                        ? "answer-correct"
                        : option.id === result.answer
                          ? "answer-wrong"
                          : ""
                      : ""
                  }
                  onClick={() => submit(option.id)}
                >
                  <span>{String.fromCharCode(65 + i)}</span>
                  {option.definition_zh}
                </Button>
              ))
            )}
          </div>
        </>
      )}
      {result && (
        <div
          className={`review-result ${result.correct ? "correct" : "incorrect"}`}
          role="status"
        >
          <strong>
            {result.correct
              ? t("已记录本次学习", "Your answer is saved")
              : t("已加入错词记录", "Saved to your wrong-word history")}
          </strong>
          {mode !== "card" && (
            <p>
              {t("正确答案", "Correct answer")}: {word.word} —{" "}
              {word.definition_zh}
            </p>
          )}
          <p>
            {result.scheduled
              ? t(
                  `下次复习：${progress?.due_date}，间隔 ${progress?.interval_days} 天。`,
                  `Next review: ${progress?.due_date}, in ${progress?.interval_days} days.`,
                )
              : t(
                  "这是未到期练习，复习日期保持不变。",
                  "This was an extra practice. The due date did not advance.",
                )}
          </p>
          {mode !== "card" && <Definition word={word} t={t} />}
          <Button onClick={next}>
            {index + 1 === ids.length
              ? t("完成本组", "Finish set")
              : t("下一个单词", "Next word")}
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </section>
  );
}

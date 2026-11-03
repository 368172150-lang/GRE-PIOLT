import { useState, useEffect, useMemo, useRef } from "react";
import { ArrowRight, Clock, Star, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { QuestionBody } from "./QuestionBody";
import { AnswerForm } from "./AnswerForm";
import { Feedback } from "./Feedback";
import type {
  Answer,
  PracticeSession,
  PracticeSnapshot,
} from "../../types/practice";
import { duration, type Translate, type PracticeRunner } from "./shared";
export function PracticeSessionView({
  session,
  snapshot,
  busy,
  run,
  t,
  onBack,
  timezone,
}: {
  session: PracticeSession;
  snapshot: PracticeSnapshot;
  busy: boolean;
  run: PracticeRunner;
  t: Translate;
  onBack: () => void;
  timezone: string;
}) {
  const attempts = snapshot.attempts.filter((a) => a.session_id === session.id);
  const [index, setIndex] = useState(() =>
      session.ended_at ? 0 : attempts.length,
    ),
    [now, setNow] = useState(Date.now());
  const request = useRef<{ key: string; id: string } | null>(null);
  const offset = useMemo(
    () => Date.parse(snapshot.server_now) - Date.now(),
    [snapshot.server_now],
  );
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const effectiveNow = session.ended_at
    ? Date.parse(session.ended_at)
    : now + offset;
  const remaining = session.deadline_at
    ? Math.max(
        0,
        Math.ceil((Date.parse(session.deadline_at) - effectiveNow) / 1000),
      )
    : null;
  const expired = !!session.deadline_at && remaining === 0 && !session.ended_at;
  const oldDay =
    session.local_date !== snapshot.today || session.timezone !== timezone;
  const id = session.question_ids[index],
    attempt = attempts.find((a) => a.question_id === id),
    question =
      attempt?.question_snapshot ?? snapshot.questions.find((q) => q.id === id);
  const closed = !!session.ended_at || expired || oldDay;
  async function submit(answer: Answer) {
    if (!question) return;
    const input = {
      kind: "submit" as const,
      date: snapshot.today,
      sessionId: session.id,
      questionId: question.id,
      revision: question.revision,
      answer,
    };
    const key = JSON.stringify(input);
    if (request.current?.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    await run({ ...input, id: request.current.id });
  }
  async function end() {
    const result = await run({ kind: "end", sessionId: session.id });
    if (result) onBack();
  }
  function next() {
    request.current = null;
    setIndex((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (index >= session.question_ids.length || !question)
    return (
      <section className="panel practice-report">
        <div className="eyebrow">PRACTICE REVIEW</div>
        <h2>{t("这一组，已经留下记录。", "This set is saved.")}</h2>
        <div className="report-numbers">
          <div>
            <strong>
              {attempts.length}
              <small> / {session.question_ids.length}</small>
            </strong>
            <span>{t("已提交题目", "Questions submitted")}</span>
          </div>
          <div>
            <strong>
              {attempts.length
                ? Math.round(
                    (attempts.filter((a) => a.is_correct).length /
                      attempts.length) *
                      100,
                  )
                : "—"}
              {attempts.length > 0 && <small>%</small>}
            </strong>
            <span>{t("已答题正确率", "Accuracy on submitted answers")}</span>
          </div>
        </div>
        {attempts.length ? (
          <div className="report-attempts">
            {session.question_ids.map((qid, i) => {
              const a = attempts.find((a) => a.question_id === qid);
              return (
                <button key={qid} disabled={!a} onClick={() => setIndex(i)}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {a
                    ? a.is_correct
                      ? t("正确", "Correct")
                      : t("待回顾", "Review")
                    : t("未作答", "Unanswered")}
                  <ArrowRight size={14} />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted">
            {t(
              "本组没有已提交的答案，未作答题目不计入正确率。",
              "No answers were submitted. Unanswered questions do not enter the accuracy calculation.",
            )}
          </p>
        )}
        <div className="report-actions">
          <Button onClick={onBack}>
            {t("返回练习设置", "Back to practice setup")}
          </Button>
          <Button asChild variant="outline">
            <Link to="/mistakes">{t("打开错题本", "Open mistake book")}</Link>
          </Button>
        </div>
      </section>
    );
  return (
    <section className="panel practice-runner">
      <div className="runner-top">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={15} />
          {t("练习设置", "Practice setup")}
        </Button>
        <div
          className={`session-clock ${expired ? "expired" : ""}`}
          role="timer"
          aria-label={t("练习计时", "Practice timer")}
        >
          <Clock size={16} />
          {remaining === null
            ? duration(
                Math.max(
                  0,
                  Math.floor(
                    (effectiveNow - Date.parse(session.started_at)) / 1000,
                  ),
                ),
              )
            : duration(remaining)}
          <span>
            {remaining === null
              ? t("经过时间", "elapsed")
              : t("剩余", "remaining")}
          </span>
        </div>
        <Button variant="outline" disabled={busy} onClick={end}>
          {t("结束本组", "End this set")}
        </Button>
      </div>
      <div className="question-progress">
        <span>
          QUESTION {String(index + 1).padStart(2, "0")} /{" "}
          {session.question_ids.length}
        </span>
        <div>
          <span
            style={{
              width: `${(attempts.length / session.question_ids.length) * 100}%`,
            }}
          />
        </div>
      </div>
      {expired && (
        <p className="time-alert" role="status">
          {t(
            "计时已结束，已保存答案不受影响。",
            "Time is up. Saved answers remain available.",
          )}{" "}
          <button
            onClick={async () => {
              if (await run({ kind: "end", sessionId: session.id }))
                setIndex(session.question_ids.length);
            }}
          >
            {t("查看已保存结果", "View saved results")}
          </button>
        </p>
      )}
      {oldDay && (
        <p className="time-alert">
          {t(
            "日期或时区已变化，请回到设置新建练习。",
            "The date or timezone changed. Return to setup to start a new set.",
          )}
        </p>
      )}
      <div className="question-toolbar">
        <span>
          {session.local_date} · {session.timezone}
        </span>
        <Button
          size="icon"
          variant="ghost"
          disabled={busy}
          aria-label={
            snapshot.bookmarks.some((b) => b.question_id === question.id)
              ? t("取消收藏题目", "Remove question favorite")
              : t("收藏题目", "Favorite question")
          }
          aria-pressed={snapshot.bookmarks.some(
            (b) => b.question_id === question.id,
          )}
          onClick={() =>
            run({
              kind: "favorite",
              questionId: question.id,
              value: !snapshot.bookmarks.some(
                (b) => b.question_id === question.id,
              ),
            })
          }
        >
          <Star
            size={18}
            fill={
              snapshot.bookmarks.some((b) => b.question_id === question.id)
                ? "currentColor"
                : "none"
            }
          />
        </Button>
      </div>
      <QuestionBody question={question} t={t} />
      <AnswerForm
        key={question.id}
        question={question}
        saved={attempt?.answer}
        solution={attempt?.feedback}
        disabled={busy || closed}
        onSubmit={submit}
        t={t}
      />
      {attempt && (
        <>
          <Feedback attempt={attempt} t={t} />
          <div className="next-question">
            <Button onClick={next}>
              {index + 1 === session.question_ids.length
                ? t("查看本组结果", "View set results")
                : t("下一题", "Next question")}
              <ArrowRight size={16} />
            </Button>
            {!attempt.is_correct && (
              <Link to="/mistakes">
                {t("到错题本记录原因", "Add a note in your mistake book")}
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}

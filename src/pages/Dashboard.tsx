import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Flame,
  CalendarDays,
  BookOpen,
  Target,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Button } from "../components/ui/button";
import { useStudy } from "../hooks/useStudy";
import { useAuth } from "../features/auth/AuthProvider";
import { summarize, weekTrend } from "../algorithms/study";
import { History } from "../features/study/History";
import { DashboardRecommendations } from "../features/analytics/DashboardRecommendations";
import { TimeLog } from "../features/study/TimeLog";
import { NoteForm } from "../features/study/NoteForm";
import {
  taskLabels,
  errorText,
  type Translate,
} from "../features/study/shared";
import type { StudySettings } from "../types";
export function Dashboard({
  settings: s,
  t,
}: {
  settings: StudySettings;
  t: Translate;
}) {
  const { user } = useAuth();
  const { snapshot, loading, busy, error, notice, run } = useStudy(s, user?.id);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  async function toggle(taskId: string, completed: boolean, date: string) {
    setPending((current) => ({ ...current, [taskId]: completed }));
    await run({ kind: "toggle", date, taskId, completed });
    setPending((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }
  if (loading && !snapshot)
    return (
      <p role="status">
        {t("正在生成今日计划…", "Preparing your daily plan…")}
      </p>
    );
  if (!snapshot)
    return (
      <section className="panel">
        <p role="alert" className="error">
          {errorText(error, t)}
        </p>
        <Button onClick={() => run({ kind: "ensure" })}>
          {t("重试", "Retry")}
        </Button>
      </section>
    );
  const date = snapshot.today,
    day = snapshot.days.find((d) => d.local_date === date)!;
  const stats = summarize(snapshot, date);
  const tasks = snapshot.tasks.filter((task) => task.local_date === date);
  const checked = snapshot.checkins.some((c) => c.local_date === date);
  const trend = weekTrend(snapshot, date);
  const hasTrend = trend.some((d) => d.minutes > 0);
  return (
    <>
      <div className="dashboard-heading">
        <div className="page-heading">
          <div className="eyebrow">A LITTLE PROGRESS, EVERY DAY</div>
          <h1>
            {t(
              `你好，${s.display_name}。今天也向前一步。`,
              `Hello, ${s.display_name}. One step forward today.`,
            )}
          </h1>
          <p className="muted">
            {t(
              `目标 ${s.target_score} 分 · 每日 ${s.daily_minutes} 分钟 · 新词目标 ${s.new_words}`,
              `Target ${s.target_score} · ${s.daily_minutes} minutes/day · ${s.new_words} new words`,
            )}
          </p>
        </div>
        <div className="date-label">
          <CalendarDays size={16} />
          {date}
          <span>{s.timezone}</span>
        </div>
      </div>
      <section className="welcome-card daily-hero">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            {checked
              ? t("今日已打卡", "CHECKED IN")
              : t("今天的学习计划", "TODAY’S STUDY PLAN")}
          </div>
          <h2>
            {checked
              ? t("今天的积累，已经留下。", "Today’s progress is here to stay.")
              : t(
                  "把目标，变成今天的行动。",
                  "Turn your goal into today’s actions.",
                )}
          </h2>
          <p>
            {t(
              `已完成 ${stats.completed} / ${stats.total} 项任务，已记录 ${stats.todayMinutes} / ${day.budget} 分钟。`,
              `Completed ${stats.completed} of ${stats.total} tasks. Recorded ${stats.todayMinutes} of ${day.budget} minutes.`,
            )}
          </p>
          <div className="hero-actions">
            <Button
              disabled={busy || checked || stats.percent < 100}
              onClick={() => run({ kind: "checkin", date })}
            >
              <CheckCircle2 size={16} />
              {checked
                ? t("今日已打卡", "Checked in today")
                : t("完成今日打卡", "Check in today")}
            </Button>
            <Link to="/settings" className="text-link plain">
              {t("查看我的学习计划", "Review my study plan")}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div
          className="daily-ring"
          style={{
            background: `conic-gradient(var(--green) ${stats.percent}%,var(--line) 0)`,
          }}
        >
          <div>
            <strong>
              {stats.percent}
              <small>%</small>
            </strong>
            <span>{t("今日完成度", "DAILY PROGRESS")}</span>
          </div>
        </div>
      </section>
      <div className="study-feedback" aria-live="polite">
        {error && (
          <div className="error" role="alert">
            {errorText(error, t)}{" "}
            <button
              className="text-link inline"
              onClick={() => run({ kind: "ensure" })}
            >
              {t("刷新", "Refresh")}
            </button>
          </div>
        )}
        {notice && !error && (
          <p role="status" className="success">
            {notice === "CHECKED_IN"
              ? t(
                  "打卡成功，今天只计一次。",
                  "Checked in. Today is counted once.",
                )
              : t("学习记录已保存。", "Your study record is saved.")}
          </p>
        )}
      </div>
      <div className="stat-grid study-stats">
        {[
          {
            icon: Flame,
            label: t("连续打卡", "Current streak"),
            value: stats.current,
            suffix: t("天", "days"),
            note: t(
              `最长连续 ${stats.longest} 天`,
              `Longest streak: ${stats.longest} days`,
            ),
          },
          {
            icon: CalendarDays,
            label: t("累计学习", "Study days"),
            value: stats.studyDays,
            suffix: t("天", "days"),
            note: t(
              `累计打卡 ${snapshot.checkins.length} 天`,
              `${snapshot.checkins.length} check-in days`,
            ),
          },
          {
            icon: Clock,
            label: t("累计学习时长", "Total study time"),
            value: stats.totalMinutes,
            suffix: t("分钟", "min"),
            note: t("来自你保存的时长记录", "From saved time entries"),
          },
          {
            icon: BookOpen,
            label: t("已掌握词汇", "Mastered vocabulary"),
            value: snapshot.signals.masteredWords,
            suffix: t("词", "words"),
            note: t(
              `待复习 ${snapshot.signals.dueReviews} 词`,
              `${snapshot.signals.dueReviews} due for review`,
            ),
          },
        ].map((v) => (
          <section className="panel stat-card" key={v.label}>
            <div className="stat-label">
              {v.label}
              <v.icon size={17} />
            </div>
            <div className="stat-value">
              {v.value}
              <small>{v.suffix}</small>
            </div>
            <p>{v.note}</p>
          </section>
        ))}
      </div>
      <div className="daily-columns">
        <section className="panel task-panel">
          <div className="section-title">
            <h2>{t("今日任务", "Today’s tasks")}</h2>
            <span className="subtle-chip">
              {stats.completed} / {stats.total}
            </span>
          </div>
          <p className="panel-description">
            {t(
              "词汇与题目练习会自动记入任务，也可记录线下完成情况；学习时长单独保存。",
              "Vocabulary and practice complete matching tasks automatically. Offline work can also be tracked; save study time separately.",
            )}
          </p>
          <div className="task-list">
            {tasks.map((task) => (
              <label
                key={task.id}
                className={`task-row ${task.completed_at ? "done" : ""}`}
              >
                <input
                  type="checkbox"
                  aria-label={`${t(...taskLabels[task.task_key])} ${task.target}`}
                  checked={pending[task.id] ?? !!task.completed_at}
                  disabled={
                    busy ||
                    checked ||
                    task.task_key === "focus" ||
                    task.completion_source === "automatic"
                  }
                  onChange={(e) => toggle(task.id, e.target.checked, date)}
                />
                <span className="task-copy">
                  <strong>{t(...taskLabels[task.task_key])}</strong>
                  <small>
                    {task.focus_type
                      ? `${t("重点", "Focus")}: ${task.focus_type} · `
                      : ""}
                    {task.task_key === "focus"
                      ? t(
                          "保存学习时长后自动更新",
                          "Updates automatically from your time log",
                        )
                      : task.completed_at
                        ? task.completion_source === "automatic"
                          ? t(
                              "由学习记录自动完成",
                              "Completed from study records",
                            )
                          : t("已手动记录", "Recorded manually")
                        : t("可记录线下学习", "Offline work can be recorded")}
                  </small>
                </span>
                <span className="task-target">
                  {task.target}{" "}
                  {task.task_key === "focus"
                    ? t("分钟", "min")
                    : ["verbal", "quant"].includes(task.task_key)
                      ? t("题", "questions")
                      : task.task_key === "mistakes"
                        ? t("次", "review")
                        : t("词", "words")}
                </span>
                {task.completion_source === "automatic" && (
                  <Check size={16} className="automatic-mark" />
                )}
              </label>
            ))}
          </div>
          <div className="plan-actions">
            <Button
              variant="outline"
              disabled={busy || checked}
              onClick={() => run({ kind: "replan", date })}
            >
              <RefreshCw size={14} />
              {t("按最新目标重排", "Replan with current goals")}
            </Button>
            <small className="muted">
              {t(
                "重排保留已完成且目标未增加的任务；打卡后锁定计划。",
                "Replanning keeps completed tasks whose targets do not increase. Plans lock after check-in.",
              )}
            </small>
          </div>
        </section>
        <div className="daily-side">
          <TimeLog key={date} date={date} busy={busy} run={run} t={t} />
          <NoteForm
            key={`${date}:${day.id}`}
            date={date}
            saved={day.notes}
            busy={busy}
            run={run}
            t={t}
          />
        </div>
      </div>
      <div className="daily-columns insights-row">
        <section className="panel">
          <div className="section-title">
            <h2>{t("最近七天", "The last seven days")}</h2>
            <span className="muted">{t("学习分钟数", "Study minutes")}</span>
          </div>
          {hasTrend ? (
            <>
              <div
                className="trend-chart"
                role="img"
                aria-label={t(
                  "最近七天的真实学习时长柱状图",
                  "Recorded study minutes over the last seven days",
                )}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => String(v).slice(5)}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted)" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      width={30}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                      }}
                      formatter={(v) => [v, t("分钟", "minutes")]}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="minutes"
                      fill="var(--green)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="chart-data">
                <summary>{t("查看图表数据", "View chart data")}</summary>
                <table>
                  <tbody>
                    {trend.map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>
                          {d.minutes} {t("分钟", "min")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <div className="trend-empty">
              <Clock size={26} />
              <h3>
                {t("从第一条学习记录开始", "Start with your first study entry")}
              </h3>
              <p>
                {t(
                  "保存学习时长后，这里将展示真实趋势。",
                  "Save a time entry to see your actual trend here.",
                )}
              </p>
            </div>
          )}
        </section>
        <section className="panel accuracy-panel">
          <div className="section-title">
            <h2>{t("练习正确率", "Practice accuracy")}</h2>
            <Target size={18} />
          </div>
          <p className="panel-description">
            {t(
              "最近 30 天的已保存答案。手动勾选不计为答题记录。",
              "Saved answers from the last 30 days. Manual task completion does not count as an answer.",
            )}
          </p>
          {(["verbal", "quant"] as const).map((m) => {
            const sig = snapshot.signals[m];
            return (
              <div className="accuracy-row" key={m}>
                <div>
                  <strong>{m === "verbal" ? "Verbal" : "Quant"}</strong>
                  <small>
                    {sig.attempts
                      ? t(
                          `${sig.correct} / ${sig.attempts} 题正确`,
                          `${sig.correct} / ${sig.attempts} correct`,
                        )
                      : t(
                          "暂无答题记录，完成练习后更新",
                          "No attempts yet; complete a practice set",
                        )}
                  </small>
                </div>
                <span>
                  {sig.attempts
                    ? `${Math.round((sig.correct / sig.attempts) * 100)}%`
                    : "—"}
                </span>
              </div>
            );
          })}
        </section>
      </div>
      <History state={snapshot} t={t} />
      <DashboardRecommendations
        key={
          snapshot.events.length +
          ":" +
          snapshot.signals.verbal.attempts +
          ":" +
          snapshot.signals.quant.attempts
        }
        userId={user?.id}
        budget={s.daily_minutes}
        t={t}
      />
    </>
  );
}

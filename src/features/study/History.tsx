import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { addDays } from "../../algorithms/dates";
import type { StudySnapshot } from "../../types/study";
import { taskLabels, type Translate } from "./shared";
export function History({ state, t }: { state: StudySnapshot; t: Translate }) {
  const [month, setMonth] = useState(state.today.slice(0, 7));
  const [selected, setSelected] = useState(state.today);
  const [query, setQuery] = useState("");
  const monthStart = `${month}-01`;
  const nextMonth = () => {
    const d = new Date(`${monthStart}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 7);
  };
  const count = Number(addDays(`${nextMonth()}-01`, -1).slice(-2));
  const offset = (new Date(`${monthStart}T12:00:00Z`).getUTCDay() + 6) % 7;
  const day = state.days.find((d) => d.local_date === selected);
  const events = state.events.filter((e) => e.local_date === selected);
  const tasks = state.tasks.filter((task) => task.local_date === selected);
  const checked = state.checkins.some((c) => c.local_date === selected);
  const rows = [...state.days]
    .filter((d) =>
      query ? d.local_date === query : d.local_date.startsWith(month),
    )
    .sort((a, b) => b.local_date.localeCompare(a.local_date));
  function move(delta: number) {
    const d = new Date(`${monthStart}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonth(d.toISOString().slice(0, 7));
    setQuery("");
  }
  return (
    <section className="panel history-panel">
      <div className="section-title">
        <h2>{t("学习日历与历史", "Study calendar and history")}</h2>
        <label className="history-search">
          {t("查询日期", "Find a date")}
          <input
            type="date"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value) {
                setMonth(e.target.value.slice(0, 7));
                setSelected(e.target.value);
              }
            }}
          />
        </label>
      </div>
      <div className="history-columns">
        <div>
          <div className="calendar-header">
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("上个月", "Previous month")}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <strong>{month}</strong>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("下个月", "Next month")}
              onClick={() => move(1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <div
            className="study-calendar"
            aria-label={t("学习日历", "Study calendar")}
          >
            {t("一,二,三,四,五,六,日", "M,T,W,T,F,S,S")
              .split(",")
              .map((label, i) => (
                <small key={i}>{label}</small>
              ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              const hasCheck = state.checkins.some(
                (c) => c.local_date === date,
              );
              const learned =
                state.events.some((e) => e.local_date === date) ||
                state.tasks.some(
                  (task) => task.local_date === date && task.completed_at,
                );
              return (
                <button
                  key={date}
                  aria-label={`${date}${hasCheck ? t(" 已打卡", " checked in") : learned ? t(" 已学习", " studied") : ""}`}
                  aria-pressed={date === selected}
                  className={`${hasCheck ? "checked" : learned ? "studied" : ""} ${date === state.today ? "today" : ""}`}
                  onClick={() => setSelected(date)}
                >
                  {i + 1}
                  {hasCheck && <span />}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span className="legend-dot checked" />
            {t("已打卡", "Checked in")}
            <span className="legend-dot studied" />
            {t("有学习记录", "Studied")}
          </div>
          <div className="history-date-list">
            {rows.length ? (
              rows.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelected(d.local_date)}
                  className={selected === d.local_date ? "selected" : ""}
                >
                  {d.local_date}
                  <span>
                    {state.events
                      .filter((e) => e.local_date === d.local_date)
                      .reduce((sum, e) => sum + e.minutes, 0)}{" "}
                    {t("分钟", "min")}
                  </span>
                </button>
              ))
            ) : (
              <p className="muted">
                {t("此范围内没有记录。", "No records in this range.")}
              </p>
            )}
          </div>
        </div>
        <div className="history-detail">
          <h3>
            {selected}{" "}
            {checked && (
              <span className="subtle-chip">{t("已打卡", "CHECKED IN")}</span>
            )}
          </h3>
          {day ? (
            <>
              <p className="muted">
                {t(
                  `计划 ${day.budget} 分钟 · 完成 ${tasks.filter((task) => task.completed_at).length}/${tasks.length} 项`,
                  `Budget ${day.budget} min · ${tasks.filter((task) => task.completed_at).length}/${tasks.length} tasks complete`,
                )}{" "}
                · {day.timezone}
              </p>
              <p className="history-note">
                {day.notes || t("这一天还没有备注。", "No note for this day.")}
              </p>
              <h4>{t("时长记录", "Time entries")}</h4>
              {events.length ? (
                <ul className="event-list">
                  {events.map((e) => (
                    <li key={e.id}>
                      <strong>
                        {e.minutes} {t("分钟", "min")}
                      </strong>
                      <span>{e.note || t("未添加说明", "No description")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  {t(
                    "这一天还没有学习时长记录。",
                    "No time entries for this day.",
                  )}
                </p>
              )}
              <details className="chart-data">
                <summary>
                  {t("查看任务完成情况", "View task completion")}
                </summary>
                <ul className="history-task-list">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      {task.completed_at ? "✓" : "○"}{" "}
                      {t(...taskLabels[task.task_key])} · {task.target}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p className="muted">
              {t(
                "这一天没有学习计划或记录。",
                "No plan or records for this day.",
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../features/auth/AuthProvider";
import { useInsights } from "../hooks/useInsights";
import { aggregateAnalytics, type Period } from "../algorithms/analytics";
import { Recommendations } from "../features/analytics/Recommendations";
import { Button } from "../components/ui/button";
import { categoryLabels, typeLabels } from "../features/practice/shared";
import type { Translate } from "../features/study/shared";
import type { StudySettings } from "../types";
const palette = ["#b4c2d3", "#e8b96f", "#679ca4", "#17866e"];
export function Analytics({
  settings,
  t,
}: {
  settings: StudySettings;
  t: Translate;
}) {
  const { user } = useAuth(),
    { source, error, busy, load } = useInsights(user?.id),
    [period, setPeriod] = useState<Period>(7);
  if (!source)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"}>
          {error
            ? t(
                "学习记录加载失败，请重试。",
                "Could not load learning records. Retry.",
              )
            : t("正在读取学习记录…", "Loading learning records…")}
        </p>
        {error && (
          <Button onClick={() => void load()}>{t("重试", "Retry")}</Button>
        )}
      </section>
    );
  const data = aggregateAnalytics(source, period),
    statusLabels: Record<string, string> = {
      new: t("未学习", "New"),
      learning: t("学习中", "Learning"),
      review: t("复习中", "Review"),
      mastered: t("已掌握", "Mastered"),
    };
  const empty = (text: string) => <div className="chart-empty">{text}</div>;
  const dateLabel = (v: string) => v.slice(5);
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">YOUR PROGRESS, FROM REAL PRACTICE</div>
        <h1>{t("学习分析", "Learning analytics")}</h1>
        <p className="muted">
          {t(
            "看见积累，找出下一步值得练习的地方。",
            "See what you have built and where to practice next.",
          )}
        </p>
      </div>
      <div className="analytics-toolbar">
        <div role="group" aria-label={t("统计范围", "Date range")}>
          {([7, 30, 90] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {t(`最近 ${p} 天`, `${p} days`)}
            </Button>
          ))}
        </div>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          <RefreshCw size={16} />
          {t("刷新记录", "Refresh records")}
        </Button>
      </div>
      <p className="muted small">
        {data.start} — {data.today} · {settings.timezone} ·{" "}
        {t(
          "日期沿用记录发生时的学习日；当前词汇分布不受范围影响。",
          "Dates retain the study day recorded at the time. Current vocabulary distribution is independent of this range.",
        )}
      </p>
      {error && (
        <p role="alert" className="error">
          {t(
            "刷新失败，暂时显示上次读取的记录。",
            "Refresh failed. Showing the last loaded records.",
          )}
        </p>
      )}
      <div className="analytics-metrics">
        <article className="panel">
          <span>{t("已记录学习时间", "Logged study time")}</span>
          <strong data-testid="analytics-minutes">
            {data.totalMinutes} <small>min</small>
          </strong>
          <p>
            {t(
              "手动申报，不叠加答题耗时",
              "Self-reported; question duration is not added",
            )}
          </p>
        </article>
        <article className="panel">
          <span>Verbal</span>
          <strong>
            {data.verbal.accuracy === null ? "—" : data.verbal.accuracy + "%"}
          </strong>
          <p>
            {data.verbal.correct} / {data.verbal.attempts}{" "}
            {t("次作答", "attempts")}
          </p>
        </article>
        <article className="panel">
          <span>Quant</span>
          <strong>
            {data.quant.accuracy === null ? "—" : data.quant.accuracy + "%"}
          </strong>
          <p>
            {data.quant.correct} / {data.quant.attempts}{" "}
            {t("次作答", "attempts")}
          </p>
        </article>
        <article className="panel">
          <span>{t("打卡日 / 完成作文", "Check-in days / essays")}</span>
          <strong>
            {data.checkins} / {data.completedWriting}
          </strong>
          <p>
            {t(
              "按创建练习时的学习日归档",
              "Essays use the study day when started",
            )}
          </p>
        </article>
      </div>
      <div className="analytics-grid">
        <section className="panel chart-panel">
          <h2>{t("每日学习时间", "Daily study time")}</h2>
          {!data.totalMinutes ? (
            empty(
              t(
                "该范围还没有学习时长记录。",
                "No logged study time in this range.",
              ),
            )
          ) : (
            <>
              <div
                className="chart-canvas"
                role="img"
                aria-label={t(
                  "每日学习分钟折线图，下方可查看原始数据",
                  "Daily study minutes line chart; data table available below",
                )}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.days}>
                    <XAxis dataKey="date" tickFormatter={dateLabel} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      isAnimationActive={false}
                      dataKey="minutes"
                      name={t("分钟", "Minutes")}
                      stroke="#17866e"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>
        <section className="panel chart-panel">
          <h2>{t("每周完成任务", "Weekly completed tasks")}</h2>
          <p className="small muted">
            {t(
              "周一开始，首尾周仅含所选范围。",
              "Weeks start Monday; edge weeks include only the selected dates.",
            )}
          </p>
          {!data.days.some((d) => d.planned) ? (
            empty(t("该范围没有计划记录。", "No planned tasks in this range."))
          ) : (
            <div
              className="chart-canvas"
              role="img"
              aria-label={t("每周任务柱状图", "Weekly task bar chart")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeks}>
                  <XAxis dataKey="week" tickFormatter={dateLabel} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    isAnimationActive={false}
                    dataKey="completed"
                    name={t("已完成", "Completed")}
                    fill="#17866e"
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="planned"
                    name={t("计划", "Planned")}
                    fill="#a4b5c9"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="panel chart-panel">
          <h2>{t("当前词汇掌握分布", "Current vocabulary distribution")}</h2>
          <div
            className="chart-canvas"
            role="img"
            aria-label={t(
              "当前词汇掌握程度环形图",
              "Current vocabulary status donut chart",
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={data.vocabulary.map((v) => ({
                    ...v,
                    name: statusLabels[v.status],
                  }))}
                  dataKey="count"
                  nameKey="name"
                  innerRadius="48%"
                  outerRadius="72%"
                >
                  {data.vocabulary.map((v, i) => (
                    <Cell key={v.status} fill={palette[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="small muted">
            {data.vocabulary
              .map((v) => `${statusLabels[v.status]} ${v.count}`)
              .join(" · ")}
          </p>
        </section>
        <section className="panel chart-panel">
          <h2>{t("Verbal / Quant 正确率变化", "Verbal / Quant accuracy")}</h2>
          {!data.verbal.attempts && !data.quant.attempts ? (
            empty(
              t(
                "完成练习后，这里显示真实正确率。",
                "Complete practice to see your accuracy.",
              ),
            )
          ) : (
            <div
              className="chart-canvas"
              role="img"
              aria-label={t(
                "每日正确率折线图，未作答日留空",
                "Daily accuracy lines; days without attempts are gaps",
              )}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.days}>
                  <XAxis dataKey="date" tickFormatter={dateLabel} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Line
                    isAnimationActive={false}
                    dataKey="verbal"
                    name="Verbal"
                    stroke="#17866e"
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    isAnimationActive={false}
                    dataKey="quant"
                    name="Quant"
                    stroke="#617bb1"
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>{t("知识点薄弱程度", "Knowledge-area review")}</h2>
        <p className="small muted">
          {t(
            "按正确率升序排列；显示次数和平均难度，小样本仅供参考。重复作答也计入。",
            "Sorted by accuracy with sample count and average difficulty. Small samples are tentative; repeats count.",
          )}
        </p>
        {!data.weaknesses.length ? (
          <p className="muted">
            {t("还没有答题记录。", "No practice attempts yet.")}
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("模块 / 知识点", "Module / category")}</th>
                  <th>{t("正确 / 作答", "Correct / attempts")}</th>
                  <th>{t("正确率", "Accuracy")}</th>
                  <th>{t("平均难度", "Average difficulty")}</th>
                </tr>
              </thead>
              <tbody>
                {data.weaknesses.map((g) => (
                  <tr key={g.module + g.category}>
                    <td>
                      {g.module} /{" "}
                      {categoryLabels[g.category]
                        ? t(...categoryLabels[g.category])
                        : typeLabels[g.category]
                          ? t(...typeLabels[g.category])
                          : g.category}
                    </td>
                    <td>
                      {g.correct} / {g.attempts}
                    </td>
                    <td>{g.accuracy}%</td>
                    <td>{g.difficulty}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel heatmap-panel">
        <h2>{t("打卡日历热力图", "Check-in calendar")}</h2>
        <p className="small muted">
          {t(
            "绿色深浅表示当天完成任务数；实心圆点表示已打卡。空白日无完成记录。",
            "Green intensity shows completed task count; a solid dot marks a check-in. Blank days have no completions.",
          )}
        </p>
        <div className="analytics-heatmap">
          {data.days.map((d) => (
            <div
              key={d.date}
              className={`heatmap-day intensity-${Math.min(3, d.completed)}`}
              title={`${d.date}: ${d.completed}/${d.planned} · ${d.minutes} min · ${d.checked ? t("已打卡", "Checked in") : t("未打卡", "Not checked in")}`}
              aria-label={`${d.date}: ${d.completed}/${d.planned} ${d.checked ? t("已打卡", "Checked in") : t("未打卡", "Not checked in")}`}
              tabIndex={0}
            >
              <span>{d.date.slice(8)}</span>
              {d.checked && <b>●</b>}
            </div>
          ))}
        </div>
      </section>
      <details className="panel analytics-data">
        <summary>{t("查看图表原始数据", "View chart data tables")}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("日期", "Date")}</th>
                <th>min</th>
                <th>{t("完成 / 计划", "Done / planned")}</th>
                <th>Verbal % (n)</th>
                <th>Quant % (n)</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.minutes}</td>
                  <td>
                    {d.completed}/{d.planned}
                  </td>
                  <td>
                    {d.verbal ?? "—"} ({d.verbalCount})
                  </td>
                  <td>
                    {d.quant ?? "—"} ({d.quantCount})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <Recommendations source={source} budget={settings.daily_minutes} t={t} />
    </>
  );
}

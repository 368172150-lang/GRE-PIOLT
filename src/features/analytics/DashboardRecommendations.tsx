import { useInsights } from "../../hooks/useInsights";
import { Recommendations } from "./Recommendations";
import type { Translate } from "../study/shared";
export function DashboardRecommendations({
  userId,
  budget,
  t,
}: {
  userId?: string;
  budget: number;
  t: Translate;
}) {
  const { source, error, load } = useInsights(userId);
  return source ? (
    <Recommendations source={source} budget={budget} t={t} />
  ) : (
    <section className="panel">
      <p role={error ? "alert" : "status"}>
        {error
          ? t("推荐暂时不可用。", "Suggestions are temporarily unavailable.")
          : t("正在整理学习建议…", "Preparing suggestions…")}
      </p>
      {error && (
        <button onClick={() => void load()}>{t("重试", "Retry")}</button>
      )}
    </section>
  );
}

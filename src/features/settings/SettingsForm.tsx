import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { settingsSchema, defaults } from "./schema";
import { saveSettings } from "../../services/settings";
import { useAuth } from "../auth/AuthProvider";
import type { StudySettings } from "../../types";
import { Button } from "../../components/ui/button";
import type { z } from "../../lib/validation";
export function SettingsForm({
  initial,
  onSaved,
  t,
  onboarding = false,
}: {
  initial: StudySettings | null;
  onSaved: (v: StudySettings) => void;
  t: (zh: string, en: string) => string;
  onboarding?: boolean;
}) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof settingsSchema>, unknown, StudySettings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initial ?? defaults,
  });
  async function submit(value: StudySettings) {
    setMessage("");
    setError("");
    try {
      await saveSettings(value, user?.id);
      onSaved(value);
      setMessage(t("学习目标已保存。", "Your goals are saved."));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <section className="panel settings-panel">
      <div className="eyebrow">
        {onboarding ? "WELCOME ABOARD" : "YOUR STUDY PREFERENCES"}
      </div>
      <h2>
        {onboarding
          ? t("先为旅程定一个方向", "Set a direction for your journey")
          : t("学习目标", "Study goals")}
      </h2>
      <p className="muted">
        {t(
          "计划为你服务。你可以随时在这里调整。",
          "Your plan should work for you. You can adjust it anytime.",
        )}
      </p>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <div className="form-grid">
          <label>
            {t("昵称", "Your name")}
            <input autoComplete="nickname" {...register("display_name")} />
          </label>
          <label>
            {t("目标总分（260–340）", "Target score (260–340)")}
            <input
              type="number"
              min="260"
              max="340"
              {...register("target_score")}
            />
          </label>
          <label>
            {t("预计考试日期（可选）", "Exam date (optional)")}
            <input type="date" {...register("exam_date")} />
          </label>
          <label>
            {t("每日学习时间", "Daily study time")}
            <select {...register("daily_minutes")}>
              {[30, 60, 90].map((v) => (
                <option key={v} value={v}>
                  {v} {t("分钟", "minutes")}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("每日新词（1–100）", "New words per day (1–100)")}
            <input type="number" min="1" max="100" {...register("new_words")} />
          </label>
          <label>
            {t("当前英语基础", "English level")}
            <select {...register("english_level")}>
              <option value="foundation">{t("基础", "Foundation")}</option>
              <option value="intermediate">{t("中等", "Intermediate")}</option>
              <option value="advanced">{t("进阶", "Advanced")}</option>
            </select>
          </label>
          <label className="col-span-full">
            {t("时区（IANA 名称）", "Timezone (IANA name)")}
            <input list="timezones" {...register("timezone")} />
            <datalist id="timezones">
              {[
                "Asia/Kuala_Lumpur",
                "Asia/Shanghai",
                "America/New_York",
                "Europe/London",
                "UTC",
              ].map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <small className="muted">
              {t(
                "打卡按此时区的本地日期计算；历史日期保留。修改目标后，可在工作台重排尚未打卡的今日计划。",
                "Check-ins use the local date in this timezone; historical dates stay unchanged. Replan an unchecked day from the dashboard after changing goals.",
              )}
            </small>
          </label>
        </div>
        {Object.entries(errors).map(([key, e]) => (
          <p role="alert" className="error" key={key}>
            {key}: {e.message}
          </p>
        ))}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? t("保存中…", "Saving…")
            : onboarding
              ? t("开启学习空间", "Create my workspace")
              : t("保存设置", "Save settings")}
          {onboarding ? <ArrowRight size={16} /> : <Check size={16} />}
        </Button>
      </form>
    </section>
  );
}

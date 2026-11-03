import { z } from "../../lib/validation";
export const settingsSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "请输入昵称 / Name is required")
    .max(50),
  target_score: z.coerce.number().int().min(260).max(340),
  exam_date: z
    .string()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date"),
  daily_minutes: z.coerce
    .number()
    .refine((v) => [30, 60, 90].includes(v), "Choose 30, 60 or 90"),
  new_words: z.coerce.number().int().min(1).max(100),
  english_level: z.enum(["foundation", "intermediate", "advanced"]),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "请输入有效 IANA 时区 / Invalid timezone"),
});
export const defaults = {
  display_name: "",
  target_score: 320,
  exam_date: "",
  daily_minutes: 60,
  new_words: 15,
  english_level: "intermediate" as const,
  timezone: "Asia/Kuala_Lumpur",
};

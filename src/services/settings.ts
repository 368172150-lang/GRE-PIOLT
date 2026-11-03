import { supabase } from "./supabase";
import { settingsSchema } from "../features/settings/schema";
import type { StudySettings } from "../types";
const localKey = "gre-pilot:local-experience:settings:v1";
export async function loadSettings(
  userId?: string,
): Promise<StudySettings | null> {
  if (userId && supabase) {
    const { data, error } = await supabase
      .from("user_settings")
      .select(
        "display_name,target_score,exam_date,daily_minutes,new_words,english_level,timezone",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data
      ? settingsSchema.parse({ ...data, exam_date: data.exam_date ?? "" })
      : null;
  }
  const raw = localStorage.getItem(localKey);
  if (!raw) return null;
  const parsed = settingsSchema.safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw new Error("本地设置损坏 / Local settings are invalid");
  return parsed.data;
}
export async function saveSettings(settings: StudySettings, userId?: string) {
  const value = settingsSchema.parse(settings);
  if (userId && supabase) {
    const { error } = await supabase
      .from("user_settings")
      .upsert(
        { ...value, exam_date: value.exam_date || null, user_id: userId },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    return;
  }
  localStorage.setItem(localKey, JSON.stringify(value));
}

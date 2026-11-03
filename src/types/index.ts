export type Language = "zh" | "en";
export interface StudySettings {
  display_name: string;
  target_score: number;
  exam_date: string;
  daily_minutes: number;
  new_words: number;
  english_level: "foundation" | "intermediate" | "advanced";
  timezone: string;
}

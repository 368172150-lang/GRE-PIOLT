import type { PracticeAction, PracticeSnapshot } from "../../types/practice";
export type Translate = (zh: string, en: string) => string;
export type PracticeRunner = (
  action: PracticeAction,
) => Promise<PracticeSnapshot | null>;
export const typeLabels: Record<string, [string, string]> = {
  text_completion: ["文本填空", "Text Completion"],
  sentence_equivalence: ["句子等价", "Sentence Equivalence"],
  reading_comprehension: ["阅读理解", "Reading Comprehension"],
  single_choice: ["单选题", "Single Choice"],
  multiple_choice: ["多选题", "Multiple Choice"],
  quantitative_comparison: ["数量比较", "Quantitative Comparison"],
  numeric_entry: ["数值填空", "Numeric Entry"],
};
export const categoryLabels: Record<string, [string, string]> = {
  arithmetic: ["算术", "Arithmetic"],
  algebra: ["代数", "Algebra"],
  geometry: ["几何", "Geometry"],
  data_analysis: ["数据分析", "Data Analysis"],
};
const messages: Record<string, [string, string]> = {
  NO_QUESTIONS: [
    "此筛选下没有题目。请调整条件，或执行 questions-seed.sql 初始化原创题库。",
    "No questions match. Adjust the filters or apply questions-seed.sql.",
  ],
  ANSWER_INCOMPLETE: [
    "请按题目要求完成全部选择或空格。",
    "Complete all required selections or blanks.",
  ],
  ANSWER_OPTION: [
    "答案包含重复选项或不属于此题的选项。",
    "The answer contains duplicate or invalid options.",
  ],
  ANSWER_FORMAT: ["答案格式不正确。", "The answer format is invalid."],
  INVALID_NUMBER: [
    "请输入有效整数、小数或分数，例如 -2、0.5、1/2。分母不能为零。",
    "Enter a whole number, decimal or fraction such as -2, 0.5 or 1/2. The denominator cannot be zero.",
  ],
  SESSION_EXPIRED: [
    "本组计时已结束，已保存答案不受影响。请结束本组或新建练习。",
    "Time is up. Saved answers remain available. End this set or start another.",
  ],
  SESSION_ENDED: [
    "本组已结束，可能已在另一个标签页完成或被新练习替代。",
    "This set has ended, possibly in another tab or because a new set started.",
  ],
  SESSION_DATE_CHANGED: [
    "练习的日期或时区已变化，请保留已保存答案并新建练习。",
    "The session date or timezone changed. Start a new set; saved answers remain.",
  ],
  DAY_CHANGED: [
    "本地日期已变化，请刷新后新建练习。",
    "The local date changed. Refresh and start a new set.",
  ],
  QUESTION_CHANGED: [
    "题目版本已更新，请结束本组并重新开始。",
    "The question was revised. End this set and start again.",
  ],
  QUESTION_ORDER: [
    "本题已在其他位置提交，或题目顺序已变化。请刷新。",
    "The question was submitted elsewhere or is out of order. Refresh the session.",
  ],
  QUESTION_NOT_FOUND: [
    "题目不存在或尚未通过审核。",
    "The question is unavailable or not reviewed.",
  ],
  SESSION_NOT_FOUND: [
    "找不到此账号的练习组。",
    "This practice session is unavailable.",
  ],
  STALE_MISTAKE: [
    "这条错题已在另一处更新，请刷新后再保存。",
    "This mistake was updated elsewhere. Refresh before saving.",
  ],
  MISTAKE_NOT_FOUND: [
    "找不到此账号的错题记录。",
    "This mistake record is unavailable.",
  ],
  SESSION_SETTINGS: [
    "每组 1–20 题，限时可设为 1–120 分钟。",
    "Use 1–20 questions and, optionally, a 1–120 minute limit.",
  ],
  IDEMPOTENCY_CONFLICT: [
    "提交编号与已有记录冲突，请刷新核对。",
    "The request ID conflicts with an existing record. Refresh and check the saved result.",
  ],
  WEB_LOCKS_REQUIRED: [
    "本地模式需要支持 Web Locks 的浏览器，并使用 localhost 或 HTTPS。",
    "Local mode requires Web Locks over localhost or HTTPS.",
  ],
  LOCAL_DATA_INVALID: [
    "本地记录无法读取，原始数据未修改。请先保留备份再排查。",
    "Local records could not be read and have not been changed. Back them up before investigating.",
  ],
};
export function practiceError(message: string, t: Translate) {
  const key = Object.keys(messages).find((key) => message.includes(key));
  return key ? t(...messages[key]) : message;
}
export function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`;
}

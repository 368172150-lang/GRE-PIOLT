import type { TaskKey, StudyAction } from "../../types/study";
export type ActionRunner = (action: StudyAction) => Promise<boolean>;
export type Translate = (zh: string, en: string) => string;
export const taskLabels: Record<TaskKey, [string, string]> = {
  new_words: ["学习新词", "Learn new words"],
  review_words: ["复习到期词汇", "Review due vocabulary"],
  verbal: ["Verbal 练习", "Verbal practice"],
  quant: ["Quant 练习", "Quant practice"],
  mistakes: ["整理错题与反思", "Review mistakes and reflect"],
  focus: ["记录学习时长", "Record study time"],
};
export function errorText(error: string, t: Translate) {
  const code = Object.keys(errors).find((k) => error.includes(k));
  return code ? t(...errors[code]) : error;
}
const errors: Record<string, [string, string]> = {
  LOCAL_DATA_INVALID: [
    "无法读取本地学习数据，原数据未修改。请先保留浏览器数据备份，再排查存储内容。",
    "Local study data could not be read and has not been modified. Back up browser data before investigating.",
  ],
  DAY_CHANGED: [
    "日期已变化，已尝试刷新今日计划。请检查后重新操作。",
    "The local date changed. Review the refreshed plan and try again.",
  ],
  DAY_LOCKED: [
    "今天已打卡，任务与计划已锁定。",
    "Today is checked in; tasks and plan are locked.",
  ],
  TASKS_INCOMPLETE: [
    "请先完成全部任务，并记录足够的学习时间。",
    "Complete all tasks and record your study time first.",
  ],
  DAILY_LIMIT: [
    "每天最多记录 1440 分钟。",
    "A day cannot exceed 1,440 recorded minutes.",
  ],
  INVALID_LOG: [
    "每次请输入 1–180 的整数分钟。",
    "Enter a whole number of minutes between 1 and 180.",
  ],
  WEB_LOCKS_REQUIRED: [
    "本地模式需要支持 Web Locks 的浏览器，请使用新版 Chrome、Edge 或 Firefox 并通过 localhost 访问。",
    "Local mode requires Web Locks. Use a modern browser over localhost or HTTPS.",
  ],
  IDEMPOTENCY_CONFLICT: [
    "该提交编号已用于另一条记录，请刷新后核对学习记录。",
    "This request ID was already used for another record. Refresh and check your log.",
  ],
};

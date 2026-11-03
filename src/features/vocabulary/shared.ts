import type { VocabAction, VocabSnapshot } from "../../types/vocabulary";
export type Translate = (zh: string, en: string) => string;
export type VocabRunner = (
  action: VocabAction,
) => Promise<VocabSnapshot | null>;
export const statusLabels = {
  new: ["未学习", "New"],
  learning: ["学习中", "Learning"],
  review: ["复习中", "Reviewing"],
  mastered: ["已掌握", "Mastered"],
} as const;
const messages: Record<string, [string, string]> = {
  STALE_REVIEW: [
    "此词的进度已在另一处更新，已尝试刷新。请重新查看后提交。",
    "This word was updated elsewhere. Review the refreshed card before submitting.",
  ],
  DAY_CHANGED: [
    "本地日期已变化。已刷新词库，请重新开始今日学习。",
    "The local date changed. Start a new session from the refreshed library.",
  ],
  CSV_TOO_LARGE: ["CSV 不能超过 500 KB。", "CSV files must be under 500 KB."],
  CSV_ROW_LIMIT: ["每次最多导入 200 行。", "Import up to 200 rows at a time."],
  CSV_QUOTES: [
    "CSV 引号格式错误，请使用模板并用双引号包围含逗号的内容。",
    "Malformed CSV quoting. Use the template and quote fields containing commas.",
  ],
  CSV_HEADERS: [
    "CSV 列名缺失或重复，请使用下载的模板。",
    "CSV headers are missing or duplicated. Use the template.",
  ],
  CSV_EMPTY: ["CSV 没有可导入的单词。", "No vocabulary rows were found."],
  CSV_ROW: ["CSV 行数据有误：", "Invalid CSV row: "],
  IMPORT_REVIEW_REQUIRED: [
    "请先检查内容和使用权限，再确认导入。",
    "Review the content and usage rights before importing.",
  ],
  WORD_NOT_FOUND: [
    "该词不存在或你没有访问权限，请刷新词库。",
    "This word is unavailable. Refresh the library.",
  ],
  WEB_LOCKS_REQUIRED: [
    "本地模式需要新版浏览器的 Web Locks 支持，并通过 localhost 或 HTTPS 访问。",
    "Local mode requires Web Locks over localhost or HTTPS.",
  ],
  LOCAL_DATA_INVALID: [
    "本地数据无法读取，原数据未修改，请先备份后排查。",
    "Local data could not be read and has not been changed. Back it up before investigating.",
  ],
  IDEMPOTENCY_CONFLICT: [
    "提交编号与已有记录冲突，请刷新核对。",
    "The request ID conflicts with an existing record. Refresh and check your history.",
  ],
};
export function vocabError(error: string, t: Translate) {
  const key = Object.keys(messages).find((key) => error.includes(key));
  return key
    ? t(...messages[key]) +
        (key === "CSV_ROW" ? error.slice(error.indexOf(key) + key.length) : "")
    : error;
}

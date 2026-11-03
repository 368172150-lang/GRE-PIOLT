import { useEffect, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { importCsv } from "../../algorithms/csv";
import type { WordContent } from "../../types/vocabulary";
import { vocabError, type Translate, type VocabRunner } from "./shared";
export function ImportDialog({
  onClose,
  run,
  busy,
  t,
  remoteError,
}: {
  onClose: () => void;
  run: VocabRunner;
  busy: boolean;
  t: Translate;
  remoteError: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<WordContent[]>([]),
    [error, setError] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  async function read(file?: File) {
    setRows([]);
    setError("");
    setNotice("");
    setReviewed(false);
    if (!file) return;
    try {
      if (file.size > 500000) throw new Error("CSV_TOO_LARGE");
      setRows(importCsv(await file.text()));
    } catch (e) {
      setError(vocabError(e instanceof Error ? e.message : String(e), t));
    }
  }
  async function submit() {
    const next = await run({ kind: "import", words: rows, reviewed: true });
    if (next) {
      setNotice(
        t(
          `导入 ${next.imported} 个单词，重复词已跳过。`,
          `Imported ${next.imported} words. Duplicates were skipped.`,
        ),
      );
      setRows([]);
      setReviewed(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="vocab-import-dialog"
      aria-labelledby="import-title"
      onClose={(e) => {
        if (!e.currentTarget.open) onClose();
      }}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
    >
      <div className="section-title">
        <h2 id="import-title">
          {t("导入个人词汇", "Import personal vocabulary")}
        </h2>
        <Button
          size="icon"
          variant="ghost"
          disabled={busy}
          onClick={onClose}
          aria-label={t("关闭导入窗口", "Close import dialog")}
        >
          <X size={18} />
        </Button>
      </div>
      <p className="panel-description">
        {t(
          "最多 200 行 / 500 KB。UTF-8 CSV，近义词、反义词和标签用 | 分隔。所有列见模板。",
          "Up to 200 rows / 500 KB. Use UTF-8 CSV, with | between synonyms, antonyms and tags. See the template for all columns.",
        )}
      </p>
      <Button asChild variant="outline">
        <a href="/vocabulary-template.csv" download>
          <Download size={15} />
          {t("下载 CSV 模板", "Download CSV template")}
        </a>
      </Button>
      <label className="file-picker">
        <Upload size={24} />
        {t("选择 CSV 文件", "Choose a CSV file")}
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {(error || remoteError) && (
        <p className="error" role="alert">
          {error || vocabError(remoteError, t)}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {rows.length > 0 && (
        <>
          <p>
            {t(
              `预览 ${rows.length} 行（显示前 8 行）`,
              `Preview: ${rows.length} rows (first 8 shown)`,
            )}
          </p>
          <div className="import-table">
            <table>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>{t("中文释义", "Chinese meaning")}</th>
                  <th>{t("难度", "Level")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((word, i) => (
                  <tr key={i}>
                    <td>{word.word}</td>
                    <td>{word.definition_zh}</td>
                    <td>{word.difficulty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="review-attestation">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {t(
              "我已检查释义与例句，并确认有权将这些内容导入个人词库。未经审核的 AI 内容不应直接导入。",
              "I have checked the meanings and examples and have permission to use this content in my private library. Review AI content before importing.",
            )}
          </label>
          <Button disabled={busy || !reviewed} onClick={submit}>
            {t("确认导入个人词库", "Import to my private library")}
          </Button>
        </>
      )}
    </dialog>
  );
}

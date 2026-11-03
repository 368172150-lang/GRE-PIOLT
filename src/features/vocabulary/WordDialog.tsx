import { useEffect, useRef } from "react";
import { X, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Definition, WordDetails } from "./WordDetails";
import type { Word, WordProgress } from "../../types/vocabulary";
import type { Translate, VocabRunner } from "./shared";
export function WordDialog({
  word,
  progress,
  busy,
  t,
  run,
  onClose,
  onPractice,
}: {
  word: Word;
  progress?: WordProgress;
  busy: boolean;
  t: Translate;
  run: VocabRunner;
  onClose: () => void;
  onPractice: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="word-dialog"
      aria-label={t(`${word.word} 词义详情`, `${word.word} word details`)}
      onClose={(e) => {
        if (!e.currentTarget.open) onClose();
      }}
    >
      <div className="dialog-close">
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("关闭词义", "Close details")}
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </div>
      <WordDetails
        word={word}
        progress={progress}
        t={t}
        busy={busy}
        run={run}
      />
      <Definition word={word} t={t} />
      <p className="muted word-source">
        {t("内容来源", "Source")}: {word.source}
      </p>
      <Button onClick={onPractice} disabled={busy}>
        {t("学习此词", "Practice this word")}
        <ArrowRight size={15} />
      </Button>
    </dialog>
  );
}

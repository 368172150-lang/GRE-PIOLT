import { useState } from "react";
import { Volume2, Star } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { Word, WordProgress } from "../../types/vocabulary";
import type { Translate, VocabRunner } from "./shared";
export function WordDetails({
  word,
  progress,
  t,
  busy,
  run,
  hideWord = false,
}: {
  word: Word;
  progress?: WordProgress;
  t: Translate;
  busy: boolean;
  run: VocabRunner;
  hideWord?: boolean;
}) {
  const [speechError, setSpeechError] = useState("");
  function speak() {
    setSpeechError("");
    if (
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      setSpeechError(
        t("此浏览器不支持发音。", "Speech synthesis is unavailable."),
      );
      return;
    }
    try {
      speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(word.word);
      speech.lang = "en-US";
      speech.rate = 0.85;
      speech.onerror = () =>
        setSpeechError(
          t(
            "发音失败，请检查系统英语语音包。",
            "Audio failed. Check your system English voices.",
          ),
        );
      speechSynthesis.speak(speech);
    } catch {
      setSpeechError(t("无法启动英语发音。", "English audio could not start."));
    }
  }
  return (
    <>
      <div className="word-heading">
        <div>
          <div className="eyebrow">
            {word.owner_id
              ? t("个人词库", "PERSONAL LIBRARY")
              : "ORIGINAL WORD NOTES"}
          </div>
          <h2>{hideWord ? "••••••" : word.word}</h2>
          {!hideWord && (
            <p>
              {word.ipa} <span>{word.part_of_speech}</span>
            </p>
          )}
        </div>
        <div className="word-tools">
          {!hideWord && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("英语发音", "Pronounce word")}
              onClick={speak}
            >
              <Volume2 size={20} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={
              progress?.favorite
                ? t("取消收藏", "Remove favorite")
                : t("收藏单词", "Favorite word")
            }
            aria-pressed={!!progress?.favorite}
            onClick={() =>
              run({
                kind: "favorite",
                wordId: word.id,
                value: !progress?.favorite,
              })
            }
          >
            <Star
              size={20}
              fill={progress?.favorite ? "currentColor" : "none"}
            />
          </Button>
        </div>
      </div>
      {speechError && (
        <p role="alert" className="error">
          {speechError}
        </p>
      )}
    </>
  );
}
export function Definition({ word, t }: { word: Word; t: Translate }) {
  return (
    <div className="word-definition">
      <span className="definition-label">DEFINITION</span>
      <p className="definition-en">{word.definition_en}</p>
      <p className="definition-zh">{word.definition_zh}</p>
      <div className="example-block">
        <p>{word.example_en}</p>
        <p>{word.example_zh}</p>
      </div>
      <dl>
        <div>
          <dt>{t("近义词", "Synonyms")}</dt>
          <dd>{word.synonyms.join(" · ") || "—"}</dd>
        </div>
        <div>
          <dt>{t("反义词", "Antonyms")}</dt>
          <dd>{word.antonyms.join(" · ") || "—"}</dd>
        </div>
      </dl>
      <div className="word-tags">
        <span>
          {t("难度", "Level")} {word.difficulty}/5
        </span>
        {word.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { askAi } from "@/app/actions/ai";
import { btnSecondary, card, inputClass, noticeError, RETRY_MESSAGE } from "@/lib/ui";

// 입문자가 바로 누를 수 있는 추천 질문
const PRESETS = ["이 줄 왜 바뀐 거야?", "이 줄이 무슨 뜻이야?", "이 줄에서 조심할 점이 있어?"];

type Props = { projectId: string; submissionId: string; line: number };

// 고른 줄에 대해 AI에게 짧게 물어본다. 답변은 저장되지 않고 이 화면에만 보인다
export default function AskAi({ projectId, submissionId, line }: Props) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(""); // 마지막으로 보낸 질문 (답변 위에 함께 보여준다)
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError("");
    setAnswer("");
    setAsked(trimmed);
    let result;
    try {
      result = await askAi(projectId, submissionId, line, trimmed);
    } catch {
      result = { error: RETRY_MESSAGE };
    } finally {
      setPending(false);
    }
    if (result.error || !result.answer) {
      setError(result.error ?? RETRY_MESSAGE);
      return;
    }
    setAnswer(result.answer);
    setQuestion("");
  }

  return (
    <section aria-label={`${line}번 줄을 AI에게 물어보기`} className={`${card} flex flex-col gap-2.5 p-4`}>
      <div>
        <h3 className="font-semibold">🤖 {line}번 줄을 AI에게 물어보기</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">참고용이에요. 답변은 저장되지 않고 나에게만 보여요.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={pending}
            onClick={() => ask(preset)}
            className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-50"
          >
            {preset}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-1.5"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={200}
          aria-label="AI에게 할 질문"
          placeholder="직접 물어보기"
          className={`${inputClass} !py-1.5 !text-xs`}
        />
        <button type="submit" disabled={pending || !question.trim()} className={`${btnSecondary} shrink-0 !px-3 !py-1.5 !text-xs`}>
          질문
        </button>
      </form>
      {/* 답변/진행 상황은 화면낭독기에도 알려준다 */}
      <div aria-live="polite">
        {pending && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="size-3 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
            AI가 생각하는 중... (최대 15초)
          </p>
        )}
        {answer && (
          <div className="rounded-xl bg-lavender-soft p-3">
            <p className="text-xs font-medium text-lavender">Q. {asked}</p>
            {/* 답변은 텍스트로만 렌더링 (React가 자동 이스케이프) */}
            <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{answer}</p>
          </div>
        )}
      </div>
      {error && <p role="alert" className={`${noticeError} !text-xs`}>{error}</p>}
    </section>
  );
}

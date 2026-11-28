"use client";

import { useState, useTransition } from "react";
import { updateProjectFeedback } from "@/app/actions/classroom";
import { formatTime } from "@/lib/tags";
import { btnGhost, btnPrimary, card, inputClass, noticeError, noticeOk } from "@/lib/ui";

// 강사가 팀 상세 화면에서 학생들에게 한마디 피드백을 남기는 카드
export default function ClassFeedbackForm({
  token,
  projectId,
  initialFeedback,
  initialFeedbackAt,
}: {
  token: string;
  projectId: string;
  initialFeedback: string;
  initialFeedbackAt: string | null;
}) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [savedFeedback, setSavedFeedback] = useState(initialFeedback);
  const [feedbackAt, setFeedbackAt] = useState(initialFeedbackAt);
  const [status, setStatus] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(nextValue: string) {
    setStatus(null);
    startTransition(async () => {
      const res = await updateProjectFeedback(token, projectId, nextValue);
      if (res.error) {
        setStatus({ type: "error", text: res.error });
        return;
      }
      const next = res.feedback ?? "";
      setFeedback(next);
      setSavedFeedback(next);
      setFeedbackAt(res.feedbackAt ?? null);
      setStatus({ type: "ok", text: next ? "팀에게 피드백을 남겼어요." : "피드백을 지웠어요." });
    });
  }

  return (
    <section className={`${card} flex flex-col gap-3 p-4`} aria-label="강사 피드백 남기기">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">💬 팀에게 한마디 피드백 남기기</h2>
        {feedbackAt && <span className="text-xs text-muted">마지막 수정 · {formatTime(feedbackAt)}</span>}
      </div>
      <p className="text-xs text-muted">
        여기에 남긴 피드백은 학생 프로젝트 화면 상단의 <strong>💬 강사 피드백</strong> 버튼에서 바로 확인할 수 있어요.
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save(feedback);
        }}
      >
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="예) 역할 분담이 깔끔하네요! 입력값이 비어 있을 때의 예외 처리도 함께 확인해보면 좋겠어요."
          className={inputClass}
        />
        {status && (
          <p role={status.type === "error" ? "alert" : "status"} className={status.type === "error" ? noticeError : noticeOk}>
            {status.text}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {savedFeedback && (
            <button type="button" disabled={pending} onClick={() => save("")} className={btnGhost}>
              지우기
            </button>
          )}
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "저장 중..." : "피드백 저장"}
          </button>
        </div>
      </form>
    </section>
  );
}

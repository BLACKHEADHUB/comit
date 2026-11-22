"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { retryAiReport } from "@/app/actions/ai";
import { btnSecondary, noticeError, RETRY_MESSAGE } from "@/lib/ui";

// AI 분석이 실패했거나 건너뛴 제출에서, 버튼 한 번으로 분석을 요청한다
export default function RetryAiButton({
  projectId,
  submissionId,
  auto = false,
  skipped = false,
}: {
  projectId: string;
  submissionId: string;
  auto?: boolean;
  skipped?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setPending(true);
    setError("");
    try {
      const result = await retryAiReport(projectId, submissionId);
      if (result.error) setError(result.error);
      else router.refresh(); // 새 분석 결과를 화면에 반영
    } catch {
      setError(RETRY_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  // 처음 화면을 열 때 한 번만 자동으로 다시 시도한다 (일시적인 오류는 사용자가 누르지 않아도 풀리게).
  // 새로고침해도 계속 반복되지 않도록 제출마다 한 번 시도했다는 표시를 남긴다
  useEffect(() => {
    if (!auto) return;
    // 표시는 타이머가 실제로 실행될 때 남긴다: 개발 모드에서 효과가 두 번 돌아도 시도는 한 번만 일어난다
    const timer = setTimeout(() => {
      const key = `comit_ai_auto_${submissionId}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        return; // 저장소를 못 쓰면 자동 시도는 건너뛴다 (버튼으로는 계속 가능)
      }
      void retry();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 화면을 처음 열 때 한 번만 실행한다
  }, []);

  return (
    <div className="mt-2 flex flex-col items-start gap-2">
      <button type="button" onClick={retry} disabled={pending} className={`${btnSecondary} !px-3 !py-1.5 !text-xs`}>
        {pending && <span className="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
        {pending ? "분석하는 중..." : skipped ? "🤖 AI 분석 요청하기" : "↻ AI 분석 다시 시도"}
      </button>
      <p className="text-[11px] text-muted">
        전체 코드가 아니라 바뀐 부분(diff 최대 12,000자)만 AI에 전송돼요.
      </p>
      {error && (
        <p role="alert" className={`${noticeError} !py-1.5 text-xs`}>
          {error}
        </p>
      )}
    </div>
  );
}

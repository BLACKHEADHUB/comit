"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { retryAiReport } from "@/app/actions/ai";
import { btnSecondary, noticeError, RETRY_MESSAGE } from "@/lib/ui";

// AI 분석이 실패했거나 건너뛴 제출에서, 버튼 한 번으로 다시 분석한다
export default function RetryAiButton({ projectId, submissionId }: { projectId: string; submissionId: string }) {
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

  return (
    <div className="mt-2 flex flex-col items-start gap-2">
      <button type="button" onClick={retry} disabled={pending} className={`${btnSecondary} !px-3 !py-1.5 !text-xs`}>
        {pending && <span className="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
        {pending ? "분석하는 중..." : "↻ AI 분석 다시 시도"}
      </button>
      {error && (
        <p role="alert" className={`${noticeError} !py-1.5 text-xs`}>
          {error}
        </p>
      )}
    </div>
  );
}

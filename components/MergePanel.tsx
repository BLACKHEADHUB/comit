"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mergeSubmission } from "@/app/actions/submission";
import { writeDraft } from "@/lib/draft";
import type { SubmissionStatus } from "@/lib/validation";

const STATUS_LABEL: Record<SubmissionStatus, string> = { PENDING: "대기", MERGED: "병합됨", STALE: "충돌(STALE)" };
const STATUS_STYLE: Record<SubmissionStatus, string> = {
  PENDING: "bg-zinc-200 dark:bg-zinc-700",
  MERGED: "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100",
  STALE: "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
};

type Props = {
  projectId: string;
  submissionId: string;
  initialStatus: SubmissionStatus;
  canMerge: boolean; // LEADER일 때만 true (서버 액션에서도 다시 검증한다)
  afterCode: string; // STALE일 때 에디터로 불러올 코드
  latestMainCode: string; // 지금 시점의 최신 mainCode (에디터 초안의 기준값)
};

export default function MergePanel({ projectId, submissionId, initialStatus, canMerge, afterCode, latestMainCode }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleMerge() {
    setPending(true);
    const result = await mergeSubmission(projectId, submissionId);
    setPending(false);

    if (result.status) setStatus(result.status);
    setIsError(Boolean(result.error) || result.status === "STALE");
    setMessage(result.error ?? result.message ?? "");
  }

  // 충돌 난 제출의 코드를 에디터로 불러와 최신 코드 기준으로 다시 Comit할 수 있게 한다
  function loadIntoEditor() {
    writeDraft(projectId, { code: afterCode, base: latestMainCode, fromStale: true });
    router.push(`/project/${projectId}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
        {canMerge && (
          <button
            type="button"
            onClick={handleMerge}
            disabled={status !== "PENDING" || pending}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "병합 중..." : "병합"}
          </button>
        )}
      </div>
      {status === "STALE" && (
        <div>
          <button
            type="button"
            onClick={loadIntoEditor}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            이 코드를 에디터로 불러와 다시 Comit하기
          </button>
        </div>
      )}
      {message && (
        <p role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

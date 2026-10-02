"use client";

import { useState } from "react";
import { mergeSubmission } from "@/app/actions/submission";
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
};

export default function MergePanel({ projectId, submissionId, initialStatus, canMerge }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleMerge() {
    setPending(true);
    const result = await mergeSubmission(projectId, submissionId);
    setPending(false);

    if (result.status) setStatus(result.status);
    setIsError(Boolean(result.error) || result.status === "STALE");
    setMessage(result.error ?? result.message ?? "");
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
      {message && (
        <p role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

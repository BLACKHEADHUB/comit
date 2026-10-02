"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mergeSubmission } from "@/app/actions/submission";
import { writeDraft } from "@/lib/draft";
import type { SubmissionStatus } from "@/lib/validation";
import { badge, btnPrimary, btnSecondary, noticeError, noticeOk, noticeWarn, RETRY_MESSAGE } from "@/lib/ui";

const STATUS_LABEL: Record<SubmissionStatus, string> = { PENDING: "대기", MERGED: "병합됨", STALE: "충돌(STALE)" };
const STATUS_STYLE: Record<SubmissionStatus, string> = {
  PENDING: "bg-surface text-muted ring-1 ring-line-strong",
  MERGED: "bg-ok-soft text-ok",
  STALE: "bg-warn-soft text-warn",
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
    let result;
    try {
      result = await mergeSubmission(projectId, submissionId);
    } catch {
      result = { error: RETRY_MESSAGE };
    } finally {
      setPending(false);
    }

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
    <div className="flex max-w-sm flex-col items-start gap-2 sm:items-end">
      <div className="flex items-center gap-3">
        <span className={`${badge} ${STATUS_STYLE[status]} !px-3 !py-1`}>{STATUS_LABEL[status]}</span>
        {canMerge && (
          <button type="button" onClick={handleMerge} disabled={status !== "PENDING" || pending} className={btnPrimary}>
            {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {pending ? "병합 중..." : "병합하기"}
          </button>
        )}
      </div>
      {status === "STALE" && (
        <button type="button" onClick={loadIntoEditor} className={btnSecondary}>
          이 코드를 에디터로 불러와 다시 Comit하기
        </button>
      )}
      {canMerge && status === "PENDING" && !message && (
        <p className="text-xs leading-relaxed text-muted sm:text-right">
          병합하면 이 코드가 프로젝트의 새 메인 코드가 돼요. 리뷰를 충분히 확인한 뒤 눌러주세요.
        </p>
      )}
      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={resultClass(isError, status)}
        >
          {message}
        </p>
      )}
    </div>
  );
}

// 오류는 빨강, 충돌(STALE) 안내는 노랑, 성공은 초록
function resultClass(isError: boolean, status: SubmissionStatus) {
  if (isError && status === "STALE") return noticeWarn;
  return isError ? noticeError : noticeOk;
}

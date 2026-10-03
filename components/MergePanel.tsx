"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { mergeSubmission } from "@/app/actions/submission";
import { useReview } from "@/components/ReviewProvider";
import { countOpen, countRoots } from "@/lib/comments";
import { writeDraft } from "@/lib/draft";
import type { SubmissionStatus } from "@/lib/validation";
import {
  badge,
  btnGhost,
  btnPrimary,
  btnSecondary,
  modalCard,
  modalOverlay,
  noticeError,
  noticeOk,
  noticeWarn,
  RETRY_MESSAGE,
  STALE_HINT,
  STALE_LABEL,
} from "@/lib/ui";

const STATUS_LABEL: Record<SubmissionStatus, string> = { PENDING: "대기", MERGED: "병합됨", STALE: STALE_LABEL };
const STATUS_STYLE: Record<SubmissionStatus, string> = {
  PENDING: "bg-surface text-muted ring-1 ring-line-strong",
  MERGED: "bg-ok-soft text-ok",
  STALE: "bg-warn-soft text-warn",
};

type Props = {
  projectId: string;
  submissionId: string;
  canMerge: boolean; // LEADER일 때만 true (서버 액션에서도 다시 검증한다)
  afterCode: string; // STALE일 때 에디터로 불러올 코드
  latestMainCode: string; // 지금 시점의 최신 mainCode (에디터 초안의 기준값)
};

export default function MergePanel({ projectId, submissionId, canMerge, afterCode, latestMainCode }: Props) {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 확인 창에 보여줄 리뷰 개수 (병합을 막지는 않고 확인만 받는다)
  // 상태는 진행 단계 바와 함께 쓰기 위해 ReviewProvider에서 가져온다
  const { comments, status, setStatus } = useReview();
  // 해결 안 된 원댓글만 센다 (해결된 버그 지적은 경고하지 않는다)
  const open = countOpen(comments);
  const likeCount = open.LIKE;
  const questionCount = open.QUESTION;
  const bugCount = open.BUG;
  const noReview = countRoots(comments) === 0; // 리뷰가 하나도 없었는지 (해결된 것도 리뷰로 친다)

  // ESC 키로 확인 창 닫기
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirmOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen]);

  async function handleMerge() {
    setConfirmOpen(false);
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
        <span title={status === "STALE" ? STALE_HINT : undefined} className={`${badge} ${STATUS_STYLE[status]} !px-3 !py-1`}>{STATUS_LABEL[status]}</span>
        {/* 이미 처리된 제출에는 병합 버튼을 보여주지 않는다 (누를 수 없는 버튼이 남아 있으면 헷갈린다) */}
        {canMerge && status === "PENDING" && (
          <button type="button" onClick={() => setConfirmOpen(true)} disabled={pending} className={btnPrimary}>
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
      {confirmOpen && (
        <div className={modalOverlay} onClick={() => setConfirmOpen(false)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className={`${modalCard} flex flex-col gap-4`}>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">이 제출을 병합할까요?</h2>
              <p className="mt-1 text-sm text-muted">병합하면 이 코드가 프로젝트의 새 메인 코드가 돼요.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg border border-line bg-surface p-2">👍 좋아요<p className="mt-0.5 text-lg font-semibold">{likeCount}</p></div>
              <div className="rounded-lg border border-line bg-surface p-2">❓ 질문<p className="mt-0.5 text-lg font-semibold">{questionCount}</p></div>
              <div className="rounded-lg border border-line bg-surface p-2">🐞 버그<p className="mt-0.5 text-lg font-semibold">{bugCount}</p></div>
            </div>
            {bugCount > 0 && (
              <p role="alert" className={noticeError}>
                🐞 해결 안 된 버그 지적이 있어요. 병합하기 전에 댓글을 한 번 더 확인해보세요.
              </p>
            )}
            {noReview && <p className={noticeWarn}>아직 리뷰가 없어요. 팀원의 리뷰 없이 병합하게 돼요.</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className={btnGhost}>
                취소
              </button>
              <button type="button" autoFocus onClick={handleMerge} className={btnPrimary}>
                {bugCount > 0 || noReview ? "그래도 병합하기" : "병합하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 오류는 빨강, 충돌(STALE) 안내는 노랑, 성공은 초록
function resultClass(isError: boolean, status: SubmissionStatus) {
  if (isError && status === "STALE") return noticeWarn;
  return isError ? noticeError : noticeOk;
}

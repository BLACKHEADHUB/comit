"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSubmission, revertMerge } from "@/app/actions/submission";
import { useReview } from "@/components/ReviewProvider";
import { canDeleteSubmission } from "@/lib/ownership";
import { btnGhost, btnSecondary, noticeError, RETRY_MESSAGE } from "@/lib/ui";

type Props = {
  projectId: string;
  submissionId: string;
  // 이 제출이 지금 원본을 만든 "가장 최근 병합"인지 (팀장에게만 되돌리기 버튼을 보여준다)
  isLatestMerge: boolean;
};

// 제출 상세 화면의 보조 동작: [제출 지우기](작성자·팀장, 병합 전) / [병합 되돌리기](팀장, 가장 최근 병합)
// 버튼은 권한이 있을 때만 보이고, 서버 액션에서 같은 규칙으로 다시 확인한다
export default function SubmissionActions({ projectId, submissionId, isLatestMerge }: Props) {
  const { viewer, status } = useReview();
  const router = useRouter();
  const [asking, setAsking] = useState<"delete" | "revert" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const mayDelete = canDeleteSubmission(viewer, viewer.submissionAuthor, status);
  const mayRevert = viewer.isLeader && status === "MERGED" && isLatestMerge;
  if (!mayDelete && !mayRevert) return null;

  async function run(kind: "delete" | "revert") {
    setPending(true);
    setError("");
    let result: { error?: string; ok?: boolean; newId?: string };
    try {
      result = kind === "delete" ? await deleteSubmission(projectId, submissionId) : await revertMerge(projectId, submissionId);
    } catch {
      result = { error: RETRY_MESSAGE };
    }
    setPending(false);
    setAsking(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    // 지웠으면 목록으로, 되돌렸으면 새로 생긴 "되돌리기" 기록으로 이동한다
    router.push(result.newId ? `/project/${projectId}/submission/${result.newId}` : `/project/${projectId}`);
  }

  const small = "!px-3 !py-1.5 !text-xs";
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {asking === null && (
        <div className="flex gap-1.5">
          {mayRevert && (
            <button type="button" onClick={() => setAsking("revert")} className={`${btnSecondary} ${small}`}>
              ↶ 이 병합 되돌리기
            </button>
          )}
          {mayDelete && (
            <button type="button" onClick={() => setAsking("delete")} className={`${btnGhost} ${small}`}>
              🗑 제출 지우기
            </button>
          )}
        </div>
      )}
      {asking && (
        <div role="group" aria-label="확인" className="flex max-w-sm flex-col gap-2 rounded-2xl border border-line bg-surface p-3 text-xs leading-relaxed sm:text-right">
          <p>
            {asking === "delete"
              ? "이 제출과 달린 댓글이 모두 지워져요. 되살릴 수 없어요."
              : "원본이 이 병합 바로 전 코드로 돌아가요. 기록은 지워지지 않고 '되돌리기' 기록이 새로 남아요. 대기 중인 제출은 다시 제출이 필요해져요."}
          </p>
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setAsking(null)} className={`${btnGhost} ${small}`}>
              취소
            </button>
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() => run(asking)}
              className={`${btnSecondary} ${small} ${asking === "delete" ? "!text-danger" : ""}`}
            >
              {pending ? "처리 중..." : asking === "delete" ? "지우기" : "되돌리기"}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className={`${noticeError} !text-xs`}>{error}</p>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { byCreatedAsc, keepIfSame, mergeById, newCommentIds, nextStatus } from "@/lib/activity";
import { startPolling } from "@/lib/polling";
import type { CommentItem, SubmissionStatus } from "@/lib/validation";

const POLL_MS = 15_000;

// 댓글 목록과 제출 상태를 상세 화면 전체(Diff 패널, 병합 버튼, 진행 단계 바)가 함께 보도록 공유한다.
// 방금 단 댓글이나 방금 한 병합이 다른 영역에도 바로 반영되게 하려는 목적
type ReviewContextValue = {
  comments: CommentItem[];
  addComment: (c: CommentItem) => void;
  updateComment: (c: CommentItem) => void; // 해결 처리 등으로 바뀐 댓글을 교체한다
  removeComments: (ids: string[]) => void; // 지운 댓글(원댓글이면 답글 포함)을 화면에서 뺀다
  viewer: Viewer;
  status: SubmissionStatus;
  setStatus: (s: SubmissionStatus) => void;
  newIds: ReadonlySet<string>; // 자동 갱신으로 새로 들어온(아직 안 본) 댓글 id
  markSeen: (ids: string[]) => void;
};
// 지금 화면을 보는 사람 (버튼을 보여줄지 정하는 용도. 실제 권한은 서버 액션이 다시 확인한다)
export type Viewer = { nickname: string; isLeader: boolean; submissionAuthor: string };

const ReviewContext = createContext<ReviewContextValue | null>(null);

type Props = {
  projectId: string;
  submissionId: string;
  viewer: Viewer;
  initialComments: CommentItem[];
  initialStatus: SubmissionStatus;
  children: React.ReactNode;
};

export function ReviewProvider({ projectId, submissionId, viewer, initialComments, initialStatus, children }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [status, setStatus] = useState(initialStatus);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const router = useRouter();
  const myNickname = viewer.nickname;

  // 폴링 콜백에서 "지금 화면의 값"과 비교하기 위해 최신 값을 ref에 담아둔다
  const latest = useRef({ comments, status });
  useEffect(() => {
    latest.current = { comments, status };
  }, [comments, status]);

  // 자동 갱신: 창에 포커스가 돌아올 때 + 15초마다 댓글과 상태를 다시 가져온다 (숨은 탭에서는 멈춤)
  useEffect(() => {
    return startPolling(async () => {
      const res = await fetch(`/api/project/${projectId}/submission/${submissionId}/review`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { status: SubmissionStatus; comments: CommentItem[] };

      const fresh = newCommentIds(latest.current.comments, data.comments, myNickname);
      if (fresh.length > 0) setNewIds((prev) => new Set([...prev, ...fresh]));
      setComments((prev) => keepIfSame(prev, mergeById(prev, data.comments).sort(byCreatedAsc))); // 바뀐 게 없으면 다시 그리지 않는다

      const next = nextStatus(latest.current.status, data.status);
      if (next !== latest.current.status) {
        setStatus(next);
        router.refresh(); // 다른 사람이 병합/충돌 처리함 → 서버가 준 값(최신 메인 코드 등)도 새로 받는다
      }
    }, POLL_MS);
  }, [projectId, submissionId, myNickname, router]);

  const value: ReviewContextValue = {
    comments,
    addComment: (c) => setComments((prev) => [...prev, c]),
    updateComment: (c) => setComments((prev) => prev.map((old) => (old.id === c.id ? c : old))),
    removeComments: (ids) => setComments((prev) => prev.filter((c) => !ids.includes(c.id))),
    viewer,
    status,
    setStatus,
    newIds,
    markSeen: (ids) =>
      setNewIds((prev) => {
        if (!ids.some((id) => prev.has(id))) return prev;
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }),
  };

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReview(): ReviewContextValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("ReviewProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}

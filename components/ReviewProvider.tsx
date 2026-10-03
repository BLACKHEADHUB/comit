"use client";

import { createContext, useContext, useState } from "react";
import type { CommentItem, SubmissionStatus } from "@/lib/validation";

// 댓글 목록과 제출 상태를 상세 화면 전체(Diff 패널, 병합 버튼, 진행 단계 바)가 함께 보도록 공유한다.
// 방금 단 댓글이나 방금 한 병합이 다른 영역에도 바로 반영되게 하려는 목적
type ReviewContextValue = {
  comments: CommentItem[];
  addComment: (c: CommentItem) => void;
  status: SubmissionStatus;
  setStatus: (s: SubmissionStatus) => void;
};
const ReviewContext = createContext<ReviewContextValue | null>(null);

type Props = { initialComments: CommentItem[]; initialStatus: SubmissionStatus; children: React.ReactNode };

export function ReviewProvider({ initialComments, initialStatus, children }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [status, setStatus] = useState(initialStatus);
  return (
    <ReviewContext.Provider value={{ comments, addComment: (c) => setComments((prev) => [...prev, c]), status, setStatus }}>
      {children}
    </ReviewContext.Provider>
  );
}

export function useReview(): ReviewContextValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("ReviewProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}

"use client";

import { createContext, useContext, useState } from "react";
import type { CommentItem } from "@/lib/validation";

// 댓글 목록을 상세 화면 전체(Diff 패널, 병합 버튼)가 함께 보도록 공유한다.
// 방금 단 댓글도 병합 확인 창의 개수에 바로 반영되게 하려는 목적
type ReviewContextValue = { comments: CommentItem[]; addComment: (c: CommentItem) => void };
const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({ initialComments, children }: { initialComments: CommentItem[]; children: React.ReactNode }) {
  const [comments, setComments] = useState(initialComments);
  return (
    <ReviewContext.Provider value={{ comments, addComment: (c) => setComments((prev) => [...prev, c]) }}>
      {children}
    </ReviewContext.Provider>
  );
}

export function useReview(): ReviewContextValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("ReviewProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}

"use client";

import FlowSteps from "@/components/FlowSteps";
import { useReview } from "@/components/ReviewProvider";
import { submissionFlow } from "@/lib/flow";
import { card } from "@/lib/ui";

// 제출 상세 상단의 진행 단계 바. 댓글을 달거나 병합하면 바로 다음 단계로 바뀐다
export default function SubmissionFlow({ isAuthor, isLeader }: { isAuthor: boolean; isLeader: boolean }) {
  const { comments, status } = useReview();
  const flow = submissionFlow({ status, commentCount: comments.length, isAuthor, isLeader });
  return (
    <section aria-label="진행 상황" className={`${card} px-4 py-3`}>
      <FlowSteps flow={flow} />
    </section>
  );
}

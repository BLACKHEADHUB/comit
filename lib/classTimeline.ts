import { summarizeChanges } from "@/lib/changes";
import type { SubmissionStatus } from "@/lib/validation";

export type TimelineSubmissionInput = {
  id: string;
  author: string;
  title: string;
  status: SubmissionStatus;
  beforeCode: string;
  afterCode: string;
  createdAt: Date;
  mergedAt?: Date | null;
};

export type TimelineCommentInput = {
  submissionId: string;
  isReply: boolean;
  tag?: string | null;
  resolved?: boolean;
};

export type ClassTimelineItem = {
  id: string;
  step: number;
  author: string;
  title: string;
  status: SubmissionStatus;
  createdAt: string;
  mergedAt: string | null;
  addedLines: number;
  removedLines: number;
  questions: number;
  bugsFound: number;
  bugsResolved: number;
  likes: number;
  replies: number;
  // 프라이버시 원칙: 병합 완료된(MERGED) 단계의 코드만 열람 가능하며 미병합 초안 코드는 싣지 않는다
  mergedCode: string | null;
  // 이전 반영 상태(beforeCode): 단계별 Diff 비교용 (MERGED일 때만 제공)
  previousMergedCode: string | null;
};

// 강사용 과정 타임라인 계산 (시간순 정렬, 미병합 코드 및 댓글 원문 미포함)
export function buildClassTimeline(
  submissions: TimelineSubmissionInput[],
  comments: TimelineCommentInput[]
): ClassTimelineItem[] {
  const stats = new Map<string, { questions: number; bugsFound: number; bugsResolved: number; likes: number; replies: number }>();
  for (const c of comments) {
    const cur = stats.get(c.submissionId) ?? { questions: 0, bugsFound: 0, bugsResolved: 0, likes: 0, replies: 0 };
    if (c.isReply) {
      cur.replies += 1;
    } else if (c.tag === "QUESTION") {
      cur.questions += 1;
    } else if (c.tag === "BUG") {
      cur.bugsFound += 1;
      if (c.resolved) cur.bugsResolved += 1;
    } else if (c.tag === "LIKE") {
      cur.likes += 1;
    }
    stats.set(c.submissionId, cur);
  }

  const ordered = [...submissions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return ordered.map((s, idx) => {
    const diff = summarizeChanges(s.beforeCode, s.afterCode);
    const c = stats.get(s.id) ?? { questions: 0, bugsFound: 0, bugsResolved: 0, likes: 0, replies: 0 };
    return {
      id: s.id,
      step: idx + 1,
      author: s.author,
      title: s.title,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      mergedAt: s.mergedAt ? s.mergedAt.toISOString() : null,
      addedLines: diff.added,
      removedLines: diff.removed,
      questions: c.questions,
      bugsFound: c.bugsFound,
      bugsResolved: c.bugsResolved,
      likes: c.likes,
      replies: c.replies,
      mergedCode: s.status === "MERGED" ? s.afterCode : null,
      previousMergedCode: s.status === "MERGED" ? s.beforeCode : null,
    };
  });
}

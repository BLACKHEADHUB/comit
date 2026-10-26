import type { CommentItem, CommentTag } from "@/lib/validation";

type Basic = Pick<CommentItem, "id" | "lineNumber" | "tag" | "parentId" | "resolved">;

// 원댓글 하나와 그 아래 답글들
export type Thread<T> = { root: T; replies: T[] };

// 한 줄에 달린 댓글 묶음
export type LineThreads<T> = {
  line: number;
  threads: Thread<T>[]; // 받은 순서 그대로 (작성 시간순)
  openCount: number; // 해결 안 된 원댓글 수 (말풍선 숫자)
  hasOpenBug: boolean; // 해결 안 된 버그 지적이 있는지 (말풍선을 🐞로 바꾸는 기준)
};

// 댓글을 줄 번호별 → 원댓글별로 묶어 줄 번호 오름차순으로 돌려준다
export function groupByLine<T extends Basic>(comments: T[]): LineThreads<T>[] {
  const threadById = new Map<string, Thread<T>>();
  const byLine = new Map<number, Thread<T>[]>();

  for (const c of comments) {
    if (c.parentId) continue;
    const thread: Thread<T> = { root: c, replies: [] };
    threadById.set(c.id, thread);
    const list = byLine.get(c.lineNumber);
    if (list) list.push(thread);
    else byLine.set(c.lineNumber, [thread]);
  }
  // 답글은 원댓글 아래에 붙인다 (원댓글을 못 찾는 답글은 버린다: 정상적으로는 생기지 않는다)
  for (const c of comments) {
    if (c.parentId) threadById.get(c.parentId)?.replies.push(c);
  }

  return [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([line, threads]) => {
      const open = threads.filter((t) => !t.root.resolved);
      return { line, threads, openCount: open.length, hasOpenBug: open.some((t) => t.root.tag === "BUG") };
    });
}

// 태그별 "해결 안 된 원댓글" 수 (병합 확인 창과 상단 요약에 쓴다)
export function countOpen(comments: Pick<CommentItem, "tag" | "parentId" | "resolved">[]): Record<CommentTag, number> & { total: number } {
  const counts = { LIKE: 0, QUESTION: 0, BUG: 0, total: 0 };
  for (const c of comments) {
    if (c.parentId || c.resolved || !c.tag) continue;
    counts[c.tag] += 1;
    counts.total += 1;
  }
  return counts;
}

// 원댓글(답글 제외) 수: 해결 여부와 상관없이 "리뷰가 있었는지" 판단할 때 쓴다
export const countRoots = (comments: Pick<CommentItem, "parentId">[]) => comments.filter((c) => !c.parentId).length;

// 해결/다시 열기를 누를 수 있는 사람: 댓글 작성자, 제출 작성자, 팀장 (서버와 화면이 같은 규칙을 쓴다)
export function canResolve(who: { nickname: string; isLeader: boolean }, commentAuthor: string, submissionAuthor: string): boolean {
  return who.isLeader || who.nickname === commentAuthor || who.nickname === submissionAuthor;
}

// 댓글 삭제: 댓글을 쓴 사람과 팀장만 (원댓글을 지우면 달린 답글도 함께 지워진다)
export function canDeleteComment(who: { nickname: string; isLeader: boolean }, commentAuthor: string): boolean {
  return who.isLeader || who.nickname === commentAuthor;
}

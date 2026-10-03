import type { CommentItem } from "@/lib/validation";

// 한 줄에 달린 댓글 묶음
export type LineThread<T> = {
  line: number;
  comments: T[]; // 받은 순서 그대로 (작성 시간순)
  hasBug: boolean; // 버그 지적이 하나라도 있는지 (말풍선을 🐞로 바꾸는 기준)
};

// 댓글을 줄 번호별로 묶어 줄 번호 오름차순으로 돌려준다
export function groupByLine<T extends Pick<CommentItem, "lineNumber" | "tag">>(comments: T[]): LineThread<T>[] {
  const byLine = new Map<number, T[]>();
  for (const c of comments) {
    const list = byLine.get(c.lineNumber);
    if (list) list.push(c);
    else byLine.set(c.lineNumber, [c]);
  }
  return [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([line, list]) => ({ line, comments: list, hasBug: list.some((c) => c.tag === "BUG") }));
}

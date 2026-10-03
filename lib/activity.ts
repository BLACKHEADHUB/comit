import type { SubmissionItem, SubmissionStatus } from "@/lib/validation";

// 화면에 있던 목록(local)과 서버에서 새로 받은 목록(server)을 id 기준으로 합친다.
// - 같은 id는 서버 값이 이긴다
// - 화면에만 있는 항목은 버리지 않는다 (방금 내가 만든 항목이, 그 직전에 출발한 조회 결과에는 없을 수 있다.
//   이 앱에는 삭제 기능이 없으므로 화면에만 있는 항목은 "아직 조회에 안 잡힌 새 항목"이다)
export function mergeById<T extends { id: string }>(local: T[], server: T[]): T[] {
  const serverIds = new Set(server.map((item) => item.id));
  return [...server, ...local.filter((item) => !serverIds.has(item.id))];
}

// 제출 목록에서 "새 활동"이 생긴 제출 id: 새로 나타났거나 댓글 수가 늘어난 것 (내가 올린 새 제출은 제외)
export function newActivityIds(
  prev: Pick<SubmissionItem, "id" | "commentCount">[],
  next: Pick<SubmissionItem, "id" | "commentCount" | "author">[],
  me: string
): string[] {
  const before = new Map(prev.map((s) => [s.id, s.commentCount]));
  return next
    .filter((s) => {
      const old = before.get(s.id);
      if (old === undefined) return s.author !== me; // 처음 보는 제출
      return s.commentCount > old; // 댓글이 늘어난 제출
    })
    .map((s) => s.id);
}

// 댓글 목록에서 새로 나타난 댓글 id (내가 쓴 것은 제외)
export function newCommentIds(prev: { id: string }[], next: { id: string; author: string }[], me: string): string[] {
  const seen = new Set(prev.map((c) => c.id));
  return next.filter((c) => !seen.has(c.id) && c.author !== me).map((c) => c.id);
}

// 상태는 PENDING에서 한 번 바뀌면(MERGED/STALE) 되돌아가지 않는다.
// 방금 병합한 직후, 그 전에 출발한 조회 결과(PENDING)가 늦게 도착해도 화면을 되돌리지 않기 위한 규칙
export function nextStatus(local: SubmissionStatus, server: SubmissionStatus): SubmissionStatus {
  return local === "PENDING" ? server : local;
}

// 작성 시간 기준 정렬 (ISO 문자열은 글자 순서가 곧 시간 순서)
export const byCreatedAsc = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);
export const byCreatedDesc = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);

import type { SubmissionItem, SubmissionStatus } from "@/lib/validation";

// 화면에 있던 목록(local)과 서버에서 새로 받은 목록(server)을 id 기준으로 합친다.
// - 같은 id는 서버 값이 이긴다
// - 화면에만 있는 항목은 "방금(1분 안에) 만든 것"일 때만 남긴다. 방금 내가 만든 항목이, 그 직전에 출발한 조회 결과에는 없을 수 있어서다.
//   그보다 오래된데 서버에 없다면 누군가 지운 항목이라 화면에서도 뺀다
export const FRESH_MS = 60_000;
export function mergeById<T extends { id: string; createdAt?: string }>(local: T[], server: T[], now = Date.now()): T[] {
  const serverIds = new Set(server.map((item) => item.id));
  const isFresh = (item: T) => !item.createdAt || now - Date.parse(item.createdAt) < FRESH_MS;
  return [...server, ...local.filter((item) => !serverIds.has(item.id) && isFresh(item))];
}

// 제출 목록에서 "새 활동"이 생긴 제출 id: 새로 나타났거나 댓글/답글이 늘어난 것 (내가 올린 새 제출은 제외)
export function newActivityIds(
  prev: Pick<SubmissionItem, "id" | "totalComments">[],
  next: Pick<SubmissionItem, "id" | "totalComments" | "author">[],
  me: string
): string[] {
  const before = new Map(prev.map((s) => [s.id, s.totalComments]));
  return next
    .filter((s) => {
      const old = before.get(s.id);
      if (old === undefined) return s.author !== me; // 처음 보는 제출
      return s.totalComments > old; // 댓글이나 답글이 늘어난 제출
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

// 내용이 그대로면 이전 배열을 그대로 돌려준다.
// React는 "같은 객체"면 다시 그리지 않으므로, 15초마다 조회해도 바뀐 게 없을 때는 화면을 다시 그리지 않는다
export function keepIfSame<T>(prev: T[], next: T[]): T[] {
  return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
}

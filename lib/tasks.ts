import type { SubmissionItem, SubmissionStatus } from "@/lib/validation";

// 사이드바 탭: 상태가 아니라 "내가 할 일" 기준으로 나눈다
export type TaskTab = "REVIEW" | "MINE" | "HISTORY";
export type StatusFilter = SubmissionStatus | "ALL";

// 탭마다 고를 수 있는 상태 필터 (첫 번째가 기본값)
export const TAB_FILTERS: Record<TaskTab, StatusFilter[]> = {
  REVIEW: ["PENDING"], // 리뷰할 것은 항상 대기 중인 제출뿐이라 필터가 필요 없다
  MINE: ["ALL", "PENDING", "MERGED", "STALE"],
  HISTORY: ["MERGED", "STALE"],
};

type TabInput = Pick<SubmissionItem, "author" | "status">;

// 이 제출이 해당 탭에 속하는가 (닉네임은 프로젝트 안에서 중복되지 않는다)
export function inTab(s: TabInput, tab: TaskTab, me: string): boolean {
  if (tab === "REVIEW") return s.status === "PENDING" && s.author !== me; // 남이 올렸고 아직 처리 전
  if (tab === "MINE") return s.author === me; // 내가 올린 것은 상태와 상관없이 전부
  return s.status !== "PENDING"; // 반영된 기록: 처리가 끝난 것 (병합됨 / 다시 제출 필요)
}

// 탭 + 상태 필터를 적용한 목록 (순서는 그대로 유지)
export function filterSubmissions<T extends TabInput>(list: T[], tab: TaskTab, me: string, status: StatusFilter): T[] {
  return list.filter((s) => inTab(s, tab, me) && (status === "ALL" || s.status === status));
}

// 탭 안의 상태 칩마다 보여줄 개수 (예: 병합됨 3, 다시 제출 필요 1)
export function countByFilter<T extends TabInput>(list: T[], tab: TaskTab, me: string): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { ALL: 0, PENDING: 0, MERGED: 0, STALE: 0 };
  for (const s of list) {
    if (!inTab(s, tab, me)) continue;
    counts.ALL += 1;
    counts[s.status] += 1;
  }
  return counts;
}

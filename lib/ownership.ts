import type { SubmissionStatus } from "@/lib/validation";

// 제출 삭제: 작성자와 팀장만, 병합된 제출은 지울 수 없다 (원본 이력이자 되돌리기의 기준이라서)
export function canDeleteSubmission(
  who: { nickname: string; isLeader: boolean },
  author: string,
  status: SubmissionStatus
): boolean {
  if (status === "MERGED") return false;
  return who.isLeader || who.nickname === author;
}

// 병합 되돌리기 기록의 제목. 되돌리기를 다시 되돌리면 "다시 적용"이 된다
export const REVERT_PREFIX = "되돌리기: ";
export const REAPPLY_PREFIX = "다시 적용: ";

export function revertTitle(title: string): string {
  const base = title.startsWith(REVERT_PREFIX)
    ? REAPPLY_PREFIX + title.slice(REVERT_PREFIX.length)
    : title.startsWith(REAPPLY_PREFIX)
      ? REVERT_PREFIX + title.slice(REAPPLY_PREFIX.length)
      : REVERT_PREFIX + title;
  return base.slice(0, 80); // 제출 제목 최대 길이
}

// 되돌리기 기록에 AI 대신 넣는 설명 카드
export function revertReport(leader: string, originalTitle: string) {
  return {
    summary: [
      `${leader}님이 '${originalTitle}' 병합을 되돌렸어요.`,
      "원본이 그 병합 바로 전 코드로 돌아갔어요.",
      "다시 적용하고 싶으면 이 기록에서 [되돌리기]를 한 번 더 누르면 돼요.",
    ],
    warning: "",
    concept: "되돌리기(revert)는 이력을 지우지 않고, 변경을 취소하는 새 기록을 남기는 방법이에요. Git도 같은 방식으로 되돌려요.",
  };
}

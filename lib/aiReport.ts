// AI 분석이 실패했거나 건너뛴 제출을 알아보기 위한 문구 (서버의 기본 리포트와 화면이 같은 값을 쓴다)
export const AI_FAILED_LINE = "AI 분석을 불러오지 못했어요.";
export const AI_SKIPPED_LINE = "이번 제출은 AI 분석 없이 저장됐어요.";
export const CHECK_CHANGES_LINE = "아래 '코드 변경'에서 바뀐 줄을 직접 확인해주세요.";

// 저장된 3줄 요약이 "AI 없이 저장됨" 기본 리포트라면 그 이유 문장을, 정상 분석이면 null을 돌려준다.
// 화면에서는 이 경우 번호 붙은 요약 대신 "괜찮아요" 안내를 보여준다 (실패 문구가 요약처럼 보이지 않게)
export function aiUnavailableReason(summary: readonly string[]): string | null {
  if (summary.includes(AI_FAILED_LINE)) return AI_FAILED_LINE;
  if (summary.includes(AI_SKIPPED_LINE)) return AI_SKIPPED_LINE;
  return null;
}

// AI 분석을 못 했을 때 저장하는 3줄 요약 (AI 모듈 자체를 못 불러온 경우에도 쓸 수 있게 가벼운 이 파일에 둔다)
export const FALLBACK_SUMMARY = ["코드가 수정되었어요.", AI_FAILED_LINE, CHECK_CHANGES_LINE];

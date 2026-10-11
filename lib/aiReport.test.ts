import { describe, expect, it } from "vitest";
import { AI_FAILED_LINE, AI_SKIPPED_LINE, aiUnavailableReason } from "@/lib/aiReport";

describe("aiUnavailableReason", () => {
  it("AI 실패 기본 리포트면 실패 이유를 돌려준다 (예전 문구로 저장된 제출도 알아본다)", () => {
    expect(aiUnavailableReason(["코드가 수정되었어요.", AI_FAILED_LINE, "Diff를 보고 직접 확인해주세요."])).toBe(AI_FAILED_LINE);
  });

  it("요청 한도로 건너뛴 리포트면 건너뛴 이유를 돌려준다", () => {
    expect(aiUnavailableReason(["요청이 많아 잠시 후 다시 시도해주세요.", AI_SKIPPED_LINE, "x"])).toBe(AI_SKIPPED_LINE);
  });

  it("정상 분석이나 빈 요약이면 null", () => {
    expect(aiUnavailableReason(["함수를 추가했어요.", "반환값을 바꿨어요.", "출력을 추가했어요."])).toBeNull();
    expect(aiUnavailableReason([])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { canDeleteComment } from "@/lib/comments";
import { canDeleteSubmission, revertTitle } from "@/lib/ownership";

const leader = { nickname: "팀장", isLeader: true };
const amy = { nickname: "에이미", isLeader: false };

describe("제출 삭제 권한", () => {
  it("작성자와 팀장은 대기·재제출 필요 제출을 지울 수 있다", () => {
    expect(canDeleteSubmission(amy, "에이미", "PENDING")).toBe(true);
    expect(canDeleteSubmission(amy, "에이미", "STALE")).toBe(true);
    expect(canDeleteSubmission(leader, "에이미", "PENDING")).toBe(true);
  });
  it("다른 팀원의 제출은 지울 수 없다", () => {
    expect(canDeleteSubmission(amy, "밥", "PENDING")).toBe(false);
  });
  it("병합된 제출은 팀장도 지울 수 없다", () => {
    expect(canDeleteSubmission(leader, "에이미", "MERGED")).toBe(false);
  });
});

describe("댓글 삭제 권한", () => {
  it("작성자와 팀장만", () => {
    expect(canDeleteComment(amy, "에이미")).toBe(true);
    expect(canDeleteComment(leader, "에이미")).toBe(true);
    expect(canDeleteComment(amy, "밥")).toBe(false);
  });
});

describe("되돌리기 제목", () => {
  it("되돌리기 → 다시 적용 → 되돌리기로 번갈아 바뀐다", () => {
    expect(revertTitle("버튼 추가")).toBe("되돌리기: 버튼 추가");
    expect(revertTitle("되돌리기: 버튼 추가")).toBe("다시 적용: 버튼 추가");
    expect(revertTitle("다시 적용: 버튼 추가")).toBe("되돌리기: 버튼 추가");
  });
  it("80자를 넘지 않는다", () => {
    expect(revertTitle("가".repeat(80)).length).toBe(80);
  });
});

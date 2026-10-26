import { describe, expect, it } from "vitest";
import { signMemberValue, verifyMemberValue } from "@/lib/signedCookie";

const P = "65f000000000000000000001";
const M = "65f0000000000000000000aa";

describe("멤버 쿠키 서명", () => {
  it("서명한 값은 검증을 통과해 멤버 id를 돌려준다", () => {
    expect(verifyMemberValue(P, signMemberValue(P, M, "s"), "s")).toBe(M);
  });
  it("서명 없는 예전 쿠키(멤버 id만)는 거절한다", () => {
    expect(verifyMemberValue(P, M, "s")).toBeUndefined();
  });
  it("멤버 id를 바꿔치기하면 거절한다", () => {
    const [, sig] = signMemberValue(P, M, "s").split(".");
    expect(verifyMemberValue(P, `65f0000000000000000000bb.${sig}`, "s")).toBeUndefined();
  });
  it("다른 프로젝트의 쿠키를 옮겨 붙이면 거절한다", () => {
    expect(verifyMemberValue("65f000000000000000000002", signMemberValue(P, M, "s"), "s")).toBeUndefined();
  });
  it("비밀값이 다르면 거절한다", () => {
    expect(verifyMemberValue(P, signMemberValue(P, M, "s"), "other")).toBeUndefined();
  });
});

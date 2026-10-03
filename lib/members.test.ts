import { describe, expect, it } from "vitest";
import { initialOf, orderMembers } from "@/lib/members";

describe("initialOf", () => {
  it("첫 글자를 돌려준다 (영문은 대문자)", () => {
    expect(initialOf("민수")).toBe("민");
    expect(initialOf("alice")).toBe("A");
    expect(initialOf("  지수")).toBe("지");
  });

  it("이모지로 시작해도 글자가 깨지지 않는다", () => {
    expect(initialOf("🐶멍멍")).toBe("🐶");
  });

  it("빈 닉네임이면 ?", () => {
    expect(initialOf("")).toBe("?");
  });
});

describe("orderMembers", () => {
  const members = [
    { nickname: "지수", role: "MEMBER" as const },
    { nickname: "팀장", role: "LEADER" as const },
    { nickname: "민수", role: "MEMBER" as const },
    { nickname: "하늘", role: "MEMBER" as const },
  ];

  it("팀장 → 나 → 나머지(들어온 순서) 순으로 정렬한다", () => {
    expect(orderMembers(members, "민수").map((m) => m.nickname)).toEqual(["팀장", "민수", "지수", "하늘"]);
  });

  it("내가 팀장이면 내가 맨 앞이고 isMe가 표시된다", () => {
    const ordered = orderMembers(members, "팀장");
    expect(ordered[0]).toEqual({ nickname: "팀장", role: "LEADER", isMe: true });
    expect(ordered.filter((m) => m.isMe)).toHaveLength(1);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const copy = [...members];
    orderMembers(members, "민수");
    expect(members).toEqual(copy);
  });
});

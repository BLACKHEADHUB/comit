import { describe, expect, it } from "vitest";
import { applyStarter, coachFor } from "@/lib/reviewCoach";

describe("coachFor", () => {
  it("비었거나 짧으면 태그에 맞는 팁과 첫마디를 준다", () => {
    expect(coachFor("LIKE", "")?.tip).toContain("왜 좋았는지");
    expect(coachFor("BUG", "버그")?.starters.length).toBeGreaterThan(0);
  });

  it("충분히 쓰면 숨긴다", () => {
    expect(coachFor("QUESTION", "이 반복문은 왜 1부터 시작하나요? 0부터가 아닌 이유가 궁금해요")).toBeNull();
  });
});

describe("applyStarter", () => {
  it("빈 칸이면 첫마디만, 쓴 글이 있으면 앞에 붙인다", () => {
    expect(applyStarter("", "좋아요. ")).toBe("좋아요. ");
    expect(applyStarter(" 깔끔 ", "좋아요. ")).toBe("좋아요. 깔끔");
  });

  it("길이 제한을 넘지 않는다", () => {
    expect(applyStarter("가".repeat(299), "첫마디 ")).toHaveLength(300);
  });
});

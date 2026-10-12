import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_ID, STARTER_TEMPLATES, starterCode } from "./templates";

describe("starterCode", () => {
  it("고른 템플릿의 코드를 돌려준다", () => {
    expect(starterCode("python")).toContain("def greet");
    expect(starterCode("javascript")).toContain("function greet");
    expect(starterCode("html")).toContain("<h1>");
  });

  it("빈 코드이거나 알 수 없는 값이면 빈 문자열이다", () => {
    expect(starterCode("empty")).toBe("");
    expect(starterCode("rm -rf")).toBe("");
    expect(starterCode(null)).toBe("");
  });

  it("기본 템플릿이 목록에 있고, 모든 코드는 제출 한도 안이다", () => {
    expect(STARTER_TEMPLATES.some((t) => t.id === DEFAULT_TEMPLATE_ID)).toBe(true);
    for (const t of STARTER_TEMPLATES) expect(t.code.length).toBeLessThan(100_000);
  });
});

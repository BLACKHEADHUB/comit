import { describe, expect, it } from "vitest";
import { codeVersion } from "@/lib/version";

describe("codeVersion", () => {
  it("같은 코드는 같은 버전, 다른 코드는 다른 버전", () => {
    expect(codeVersion("a = 1\n")).toBe(codeVersion("a = 1\n"));
    expect(codeVersion("a = 1\n")).not.toBe(codeVersion("a = 2\n"));
  });

  it("공백 하나만 달라도 다른 버전 (병합 조건이 글자 단위 비교이기 때문)", () => {
    expect(codeVersion("a = 1")).not.toBe(codeVersion("a = 1 "));
  });

  it("빈 코드도 버전이 있고, 길이는 16자로 고정", () => {
    expect(codeVersion("")).toHaveLength(16);
    expect(codeVersion("x".repeat(100_000))).toHaveLength(16);
  });
});

import { describe, expect, it } from "vitest";
import { summarizeChanges } from "@/lib/changes";

describe("summarizeChanges", () => {
  it("같은 코드면 모두 0", () => {
    expect(summarizeChanges("a\nb\n", "a\nb\n")).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(summarizeChanges("", "")).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("줄을 추가하면 추가만 센다", () => {
    expect(summarizeChanges("a\nb\n", "a\nb\nc\nd\n")).toEqual({ added: 2, removed: 0, changed: 2 });
  });

  it("줄을 지우면 삭제만 센다", () => {
    expect(summarizeChanges("a\nb\nc\n", "a\nc\n")).toEqual({ added: 0, removed: 1, changed: 1 });
  });

  it("한 줄을 고치면 추가 1, 삭제 1이지만 바뀐 줄은 1", () => {
    expect(summarizeChanges("a\nb\nc\n", "a\nB\nc\n")).toEqual({ added: 1, removed: 1, changed: 1 });
  });

  it("떨어진 두 곳을 고치면 각각 더한다", () => {
    const before = "1\n2\n3\n4\n5\n";
    const after = "one\n2\n3\n4\nfive\nsix\n";
    expect(summarizeChanges(before, after)).toEqual({ added: 3, removed: 2, changed: 3 });
  });

  it("빈 원본에 처음 코드를 쓰는 경우", () => {
    expect(summarizeChanges("", "print('hi')\nprint('bye')")).toEqual({ added: 2, removed: 0, changed: 2 });
  });
});

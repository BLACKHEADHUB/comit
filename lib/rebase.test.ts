import { describe, expect, it } from "vitest";
import { resolveMerge, threeWayMerge } from "@/lib/rebase";

const code = (...lines: string[]) => lines.join("\n") + "\n";
const BASE = code("one", "two", "three", "four", "five", "six");

describe("threeWayMerge", () => {
  it("아무도 안 고쳤으면 기준 그대로", () => {
    const result = threeWayMerge(BASE, BASE, BASE);
    expect(result.conflicts).toBe(0);
    expect(resolveMerge(result)).toBe(BASE);
  });

  it("나만 고쳤으면 내 코드가 된다", () => {
    const mine = code("one", "TWO", "three", "four", "five", "six");
    const result = threeWayMerge(BASE, mine, BASE);
    expect(result.conflicts).toBe(0);
    expect(resolveMerge(result)).toBe(mine);
  });

  it("최신 원본만 바뀌었으면 최신 원본이 된다", () => {
    const theirs = code("one", "two", "three", "four", "five", "six", "seven");
    const result = threeWayMerge(BASE, BASE, theirs);
    expect(result.conflicts).toBe(0);
    expect(resolveMerge(result)).toBe(theirs);
  });

  it("서로 떨어진 곳을 고쳤으면 자동으로 둘 다 반영한다", () => {
    const mine = code("ONE", "two", "three", "four", "five", "six");
    const theirs = code("one", "two", "three", "four", "five", "SIX");
    const result = threeWayMerge(BASE, mine, theirs);
    expect(result.conflicts).toBe(0);
    expect(resolveMerge(result)).toBe(code("ONE", "two", "three", "four", "five", "SIX"));
  });

  it("한쪽은 줄을 지우고 다른 쪽은 떨어진 곳에 줄을 추가한 경우", () => {
    const mine = code("one", "three", "four", "five", "six"); // two 삭제
    const theirs = code("one", "two", "three", "four", "five", "extra", "six");
    const result = threeWayMerge(BASE, mine, theirs);
    expect(result.conflicts).toBe(0);
    expect(resolveMerge(result)).toBe(code("one", "three", "four", "five", "extra", "six"));
  });

  it("양쪽이 똑같이 고쳤으면 겹침이 아니다", () => {
    const same = code("one", "two", "THREE", "four", "five", "six");
    const result = threeWayMerge(BASE, same, same);
    expect(result.conflicts).toBe(0);
    expect(resolveMerge(result)).toBe(same);
  });

  it("같은 줄을 다르게 고치면 겹침으로 돌려준다", () => {
    const mine = code("one", "two", "MINE", "four", "five", "six");
    const theirs = code("one", "two", "THEIRS", "four", "five", "six");
    const result = threeWayMerge(BASE, mine, theirs);
    expect(result.conflicts).toBe(1);
    const conflict = result.segments.find((s) => s.type === "conflict");
    expect(conflict).toEqual({ type: "conflict", base: ["three"], mine: ["MINE"], theirs: ["THEIRS"] });
  });

  it("바로 붙어 있는 줄을 각각 고친 경우도 겹침으로 본다 (보수적으로 사람에게 묻는다)", () => {
    const mine = code("one", "TWO", "three", "four", "five", "six");
    const theirs = code("one", "two", "THREE", "four", "five", "six");
    expect(threeWayMerge(BASE, mine, theirs).conflicts).toBe(1);
  });

  it("같은 자리에 서로 다른 줄을 끼워 넣으면 겹침", () => {
    const mine = code("one", "mine-new", "two", "three", "four", "five", "six");
    const theirs = code("one", "theirs-new", "two", "three", "four", "five", "six");
    const result = threeWayMerge(BASE, mine, theirs);
    expect(result.conflicts).toBe(1);
  });

  it("겹침과 자동 반영이 함께 있는 경우", () => {
    const mine = code("MINE", "two", "three", "four", "five", "six", "mine-tail");
    const theirs = code("THEIRS", "two", "three", "FOUR", "five", "six");
    const result = threeWayMerge(BASE, mine, theirs);
    expect(result.conflicts).toBe(1);
    // 겹치지 않은 부분(FOUR, mine-tail)은 고르지 않아도 둘 다 들어간다
    expect(resolveMerge(result, ["mine"])).toBe(code("MINE", "two", "three", "FOUR", "five", "six", "mine-tail"));
  });

  it("빈 원본에서 시작한 경우 (첫 코드를 각자 쓴 경우)는 겹침", () => {
    const result = threeWayMerge("", "print('a')\n", "print('b')\n");
    expect(result.conflicts).toBe(1);
  });
});

describe("resolveMerge", () => {
  const mine = code("one", "two", "MINE", "four", "five", "six");
  const theirs = code("one", "two", "THEIRS", "four", "five", "six");
  const result = threeWayMerge(BASE, mine, theirs);

  it("내 변경 쓰기", () => {
    expect(resolveMerge(result, ["mine"])).toBe(mine);
  });

  it("최신 원본 유지", () => {
    expect(resolveMerge(result, ["theirs"])).toBe(theirs);
  });

  it("둘 다 넣기: 최신 원본 → 내 변경 순서", () => {
    expect(resolveMerge(result, ["both"])).toBe(code("one", "two", "THEIRS", "MINE", "four", "five", "six"));
  });

  it("고르지 않은 겹침은 최신 원본 쪽을 쓴다 (다른 사람의 변경을 조용히 지우지 않는다)", () => {
    expect(resolveMerge(result)).toBe(theirs);
  });
});

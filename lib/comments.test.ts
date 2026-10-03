import { describe, expect, it } from "vitest";
import { groupByLine } from "@/lib/comments";

const c = (lineNumber: number, tag: "LIKE" | "QUESTION" | "BUG", id: string) => ({ lineNumber, tag, id });

describe("groupByLine", () => {
  it("댓글이 없으면 빈 배열", () => {
    expect(groupByLine([])).toEqual([]);
  });

  it("줄 번호별로 묶고 줄 번호 오름차순으로 정렬한다", () => {
    const threads = groupByLine([c(12, "LIKE", "a"), c(3, "QUESTION", "b"), c(12, "LIKE", "c")]);
    expect(threads.map((t) => t.line)).toEqual([3, 12]);
    expect(threads[1].comments.map((x) => x.id)).toEqual(["a", "c"]); // 같은 줄 안에서는 받은 순서 유지
  });

  it("버그 지적이 하나라도 있으면 hasBug", () => {
    const threads = groupByLine([c(1, "LIKE", "a"), c(1, "BUG", "b"), c(2, "QUESTION", "c")]);
    expect(threads[0].hasBug).toBe(true);
    expect(threads[1].hasBug).toBe(false);
  });
});

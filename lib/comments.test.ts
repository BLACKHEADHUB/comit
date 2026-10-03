import { describe, expect, it } from "vitest";
import { canResolve, countOpen, countRoots, groupByLine } from "@/lib/comments";

type Tag = "LIKE" | "QUESTION" | "BUG";
const root = (id: string, lineNumber: number, tag: Tag, resolved = false) => ({ id, lineNumber, tag, parentId: null, resolved });
const reply = (id: string, parentId: string, lineNumber: number) => ({ id, lineNumber, tag: null, parentId, resolved: false });

describe("groupByLine", () => {
  it("댓글이 없으면 빈 배열", () => {
    expect(groupByLine([])).toEqual([]);
  });

  it("줄 번호별로 묶고 줄 번호 오름차순으로 정렬한다", () => {
    const lines = groupByLine([root("a", 12, "LIKE"), root("b", 3, "QUESTION"), root("c", 12, "LIKE")]);
    expect(lines.map((l) => l.line)).toEqual([3, 12]);
    expect(lines[1].threads.map((t) => t.root.id)).toEqual(["a", "c"]); // 같은 줄 안에서는 받은 순서 유지
  });

  it("답글은 원댓글 아래에 붙고, 줄의 댓글 수에는 들어가지 않는다", () => {
    const lines = groupByLine([root("a", 1, "QUESTION"), reply("r1", "a", 1), reply("r2", "a", 1)]);
    expect(lines).toHaveLength(1);
    expect(lines[0].threads).toHaveLength(1);
    expect(lines[0].threads[0].replies.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(lines[0].openCount).toBe(1);
  });

  it("해결된 댓글은 숫자와 버그 표시에서 빠진다 (묶음에는 남는다)", () => {
    const lines = groupByLine([root("a", 1, "BUG", true), root("b", 1, "LIKE"), root("c", 2, "BUG", true)]);
    expect(lines[0].threads).toHaveLength(2);
    expect(lines[0].openCount).toBe(1);
    expect(lines[0].hasOpenBug).toBe(false);
    expect(lines[1].openCount).toBe(0);
  });

  it("해결 안 된 버그 지적이 있으면 hasOpenBug", () => {
    expect(groupByLine([root("a", 1, "LIKE"), root("b", 1, "BUG")])[0].hasOpenBug).toBe(true);
  });

  it("원댓글을 못 찾는 답글은 무시한다", () => {
    expect(groupByLine([reply("r", "없는-id", 1)])).toEqual([]);
  });
});

describe("countOpen", () => {
  it("해결 안 된 원댓글만 태그별로 센다", () => {
    const counts = countOpen([root("a", 1, "BUG"), root("b", 1, "BUG", true), root("c", 2, "LIKE"), reply("r", "a", 1)]);
    expect(counts).toEqual({ LIKE: 1, QUESTION: 0, BUG: 1, total: 2 });
  });
});

describe("countRoots", () => {
  it("해결 여부와 상관없이 원댓글만 센다", () => {
    expect(countRoots([root("a", 1, "BUG", true), reply("r", "a", 1)])).toBe(1);
  });
});

describe("canResolve", () => {
  const member = { nickname: "지수", isLeader: false };

  it("댓글 작성자, 제출 작성자, 팀장은 해결할 수 있다", () => {
    expect(canResolve(member, "지수", "민수")).toBe(true); // 내가 쓴 댓글
    expect(canResolve(member, "하늘", "지수")).toBe(true); // 내 제출에 달린 댓글
    expect(canResolve({ nickname: "팀장", isLeader: true }, "하늘", "민수")).toBe(true);
  });

  it("그 외의 팀원은 해결할 수 없다", () => {
    expect(canResolve(member, "하늘", "민수")).toBe(false);
  });
});

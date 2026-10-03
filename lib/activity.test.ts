import { describe, expect, it } from "vitest";
import { byCreatedAsc, byCreatedDesc, keepIfSame, mergeById, newActivityIds, newCommentIds, nextStatus } from "@/lib/activity";

describe("mergeById", () => {
  it("같은 id는 서버 값이 이긴다", () => {
    const merged = mergeById([{ id: "a", v: 1 }], [{ id: "a", v: 2 }]);
    expect(merged).toEqual([{ id: "a", v: 2 }]);
  });

  it("화면에만 있는 항목(방금 만든 것)은 버리지 않는다", () => {
    const merged = mergeById([{ id: "new" }, { id: "a" }], [{ id: "a" }, { id: "b" }]);
    expect(merged.map((x) => x.id).sort()).toEqual(["a", "b", "new"]);
  });

  it("빈 목록끼리도 동작한다", () => {
    expect(mergeById([], [])).toEqual([]);
  });
});

describe("newActivityIds", () => {
  const prev = [{ id: "a", commentCount: 1 }];

  it("남이 올린 새 제출은 새 활동", () => {
    expect(newActivityIds(prev, [{ id: "a", commentCount: 1, author: "지수" }, { id: "b", commentCount: 0, author: "지수" }], "민수")).toEqual(["b"]);
  });

  it("내가 올린 새 제출은 새 활동이 아니다", () => {
    expect(newActivityIds(prev, [{ id: "b", commentCount: 0, author: "민수" }], "민수")).toEqual([]);
  });

  it("댓글 수가 늘면 새 활동, 그대로면 아니다", () => {
    expect(newActivityIds(prev, [{ id: "a", commentCount: 2, author: "민수" }], "민수")).toEqual(["a"]);
    expect(newActivityIds(prev, [{ id: "a", commentCount: 1, author: "민수" }], "민수")).toEqual([]);
  });
});

describe("newCommentIds", () => {
  it("처음 보는 남의 댓글만 고른다", () => {
    const next = [{ id: "1", author: "지수" }, { id: "2", author: "지수" }, { id: "3", author: "민수" }];
    expect(newCommentIds([{ id: "1" }], next, "민수")).toEqual(["2"]);
  });
});

describe("nextStatus", () => {
  it("대기 중이면 서버 상태를 따른다", () => {
    expect(nextStatus("PENDING", "MERGED")).toBe("MERGED");
    expect(nextStatus("PENDING", "STALE")).toBe("STALE");
    expect(nextStatus("PENDING", "PENDING")).toBe("PENDING");
  });

  it("이미 처리된 상태는 늦게 도착한 PENDING으로 되돌리지 않는다", () => {
    expect(nextStatus("MERGED", "PENDING")).toBe("MERGED");
    expect(nextStatus("STALE", "PENDING")).toBe("STALE");
  });
});

describe("정렬", () => {
  const list = [{ createdAt: "2026-10-04T02:00:00.000Z" }, { createdAt: "2026-10-04T01:00:00.000Z" }];
  it("오래된 순 / 최신 순", () => {
    expect([...list].sort(byCreatedAsc)[0].createdAt).toContain("T01");
    expect([...list].sort(byCreatedDesc)[0].createdAt).toContain("T02");
  });
});

describe("keepIfSame", () => {
  it("내용이 같으면 이전 배열(같은 객체)을 돌려준다", () => {
    const prev = [{ id: "a", n: 1 }];
    expect(keepIfSame(prev, [{ id: "a", n: 1 }])).toBe(prev);
  });

  it("내용이 다르면 새 배열을 돌려준다", () => {
    const prev = [{ id: "a", n: 1 }];
    const next = [{ id: "a", n: 2 }];
    expect(keepIfSame(prev, next)).toBe(next);
  });
});

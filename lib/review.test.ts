import { describe, expect, it } from "vitest";
import { toCommentItem } from "@/lib/review";

const base = { _id: "c1", author: "민수", lineNumber: 3, createdAt: new Date("2026-10-04T00:00:00Z") };

describe("toCommentItem", () => {
  it("예전 댓글(parentId/resolved 필드 없음)은 원댓글·미해결로 본다", () => {
    expect(toCommentItem({ ...base, tag: "BUG", content: "여기 이상해요" })).toEqual({
      id: "c1",
      author: "민수",
      lineNumber: 3,
      tag: "BUG",
      content: "여기 이상해요",
      createdAt: "2026-10-04T00:00:00.000Z",
      parentId: null,
      resolved: false,
    });
  });

  it("답글은 태그가 null이고 parentId가 문자열로 바뀐다", () => {
    const item = toCommentItem({ ...base, content: "고마워요", parentId: { toString: () => "p1" } });
    expect(item.tag).toBeNull();
    expect(item.parentId).toBe("p1");
  });

  it("resolved가 true일 때만 해결로 본다", () => {
    expect(toCommentItem({ ...base, tag: "LIKE", resolved: true }).resolved).toBe(true);
    expect(toCommentItem({ ...base, tag: "LIKE", resolved: null }).resolved).toBe(false);
  });
});

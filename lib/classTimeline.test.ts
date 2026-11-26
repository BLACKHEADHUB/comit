import { describe, expect, it } from "vitest";
import { buildClassTimeline } from "@/lib/classTimeline";

describe("buildClassTimeline", () => {
  it("sorts chronologically, exposes mergedCode only for MERGED, and aggregates process counts", () => {
    const t1 = new Date("2026-11-20T10:00:00Z");
    const t2 = new Date("2026-11-20T11:00:00Z");
    const t3 = new Date("2026-11-20T12:00:00Z");

    const items = buildClassTimeline(
      [
        {
          id: "s3",
          author: "민수",
          title: "세 번째",
          status: "PENDING",
          beforeCode: "a\nb",
          afterCode: "a\nb\nc",
          createdAt: t3,
        },
        {
          id: "s1",
          author: "영희",
          title: "첫 구현",
          status: "MERGED",
          beforeCode: "",
          afterCode: "a\nb",
          createdAt: t1,
          mergedAt: t2,
        },
        {
          id: "s2",
          author: "철수",
          title: "충돌난 시도",
          status: "STALE",
          beforeCode: "",
          afterCode: "secret draft",
          createdAt: t2,
        },
      ],
      [
        { submissionId: "s1", isReply: false, tag: "QUESTION" },
        { submissionId: "s1", isReply: false, tag: "BUG", resolved: true },
        { submissionId: "s1", isReply: true },
        { submissionId: "s2", isReply: false, tag: "BUG", resolved: false },
      ]
    );

    expect(items.map((i) => i.id)).toEqual(["s1", "s2", "s3"]);
    expect(items.map((i) => i.step)).toEqual([1, 2, 3]);

    // 병합된 제출만 코드 열람 가능
    expect(items[0].mergedCode).toBe("a\nb");
    expect(items[0].previousMergedCode).toBe("");
    expect(items[0].addedLines).toBe(2);
    expect(items[0].questions).toBe(1);
    expect(items[0].bugsFound).toBe(1);
    expect(items[0].bugsResolved).toBe(1);
    expect(items[0].replies).toBe(1);

    // 미병합(STALE, PENDING) 제출 코드는 절대 노출하지 않음
    expect(items[1].mergedCode).toBeNull();
    expect(items[1].previousMergedCode).toBeNull();
    expect(items[1].bugsFound).toBe(1);
    expect(items[1].bugsResolved).toBe(0);
    expect(items[2].mergedCode).toBeNull();
    expect(items[2].previousMergedCode).toBeNull();
  });
});

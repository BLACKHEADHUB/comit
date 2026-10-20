import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { MAX_LIST_ITEMS, submissionListPipeline, toSubmissionItem } from "@/lib/submissions";

describe("submissionListPipeline", () => {
  it("첫 단계에서 projectId로 거른다 (다른 프로젝트 데이터 차단)", () => {
    const projectId = new Types.ObjectId();
    const pipeline = submissionListPipeline(projectId, "comments");
    expect(pipeline[0]).toEqual({ $match: { projectId } });
  });

  it("최근 제출만 가져오도록 $lookup 전에 개수를 제한한다", () => {
    const pipeline = submissionListPipeline(new Types.ObjectId(), "comments");
    const limitAt = pipeline.findIndex((stage) => "$limit" in stage);
    const lookupAt = pipeline.findIndex((stage) => "$lookup" in stage);
    expect(pipeline[limitAt]).toEqual({ $limit: MAX_LIST_ITEMS });
    expect(limitAt).toBeGreaterThan(0);
    expect(limitAt).toBeLessThan(lookupAt);
  });

  it("댓글은 $lookup 한 번으로 붙이고, 코드 본문은 결과에 싣지 않는다", () => {
    const pipeline = submissionListPipeline(new Types.ObjectId(), "comments");
    const lookups = pipeline.filter((stage) => "$lookup" in stage);
    expect(lookups).toHaveLength(1);

    const project = pipeline.find((stage) => "$project" in stage) as { $project: Record<string, unknown> };
    expect(Object.keys(project.$project)).not.toContain("beforeCode");
    expect(Object.keys(project.$project)).not.toContain("afterCode");
    expect(Object.keys(project.$project)).not.toContain("comments");
  });
});

describe("배지 숫자 조건", () => {
  it("해결 안 된 원댓글만 세도록 parentId와 resolved를 함께 본다", () => {
    const pipeline = submissionListPipeline(new Types.ObjectId(), "comments");
    const project = pipeline.find((stage) => "$project" in stage) as { $project: Record<string, unknown> };
    const counted = JSON.stringify(project.$project.commentCount);
    expect(counted).toContain("$$this.parentId");
    expect(counted).toContain("$$this.resolved");
    // 버그 수도 같은 조건 + BUG 태그
    const bugs = JSON.stringify(project.$project.bugCount);
    expect(bugs).toContain("$$this.resolved");
    expect(bugs).toContain("BUG");
  });
});

describe("toSubmissionItem", () => {
  const base = { _id: new Types.ObjectId(), title: "버튼 추가", author: "민수", status: "PENDING" as const, createdAt: new Date("2026-10-04T00:00:00Z") };

  it("id와 날짜를 문자열로 바꾼다", () => {
    const item = toSubmissionItem({ ...base, commentCount: 3, bugCount: 1, hasWarning: true, totalComments: 5 });
    expect(item).toEqual({
      id: String(base._id),
      title: "버튼 추가",
      author: "민수",
      status: "PENDING",
      createdAt: "2026-10-04T00:00:00.000Z",
      commentCount: 3,
      bugCount: 1,
      hasWarning: true,
      totalComments: 5,
    });
  });

  it("집계 값이 없으면 0/false로 채운다", () => {
    const item = toSubmissionItem(base);
    expect(item.commentCount).toBe(0);
    expect(item.bugCount).toBe(0);
    expect(item.hasWarning).toBe(false);
    expect(item.totalComments).toBe(0);
  });
});

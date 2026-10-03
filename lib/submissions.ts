import "server-only";
import type { PipelineStage, Types } from "mongoose";
import type { SubmissionItem, SubmissionStatus } from "@/lib/validation";
import { Comment } from "@/models/Comment";
import { Submission } from "@/models/Submission";

// aggregate 결과 한 줄의 모양
export type SubmissionRow = {
  _id: unknown;
  title: string;
  author: string;
  status: SubmissionStatus;
  createdAt: Date;
  commentCount?: number;
  bugCount?: number;
  hasWarning?: boolean;
  totalComments?: number;
};

// "해결 안 된 원댓글" 조건. 예전 댓글에는 parentId/resolved 필드가 없으므로, 없으면 원댓글·미해결로 본다
const OPEN_ROOT = {
  $and: [{ $eq: [{ $ifNull: ["$$this.parentId", null] }, null] }, { $ne: ["$$this.resolved", true] }],
};

// 목록 + 카드 배지용 집계를 쿼리 한 번으로 가져오는 파이프라인.
// 첫 단계에서 반드시 projectId로 거른다 (멀티테넌시 격리). 코드 본문은 싣지 않는다
export function submissionListPipeline(projectId: Types.ObjectId, commentCollection: string): PipelineStage[] {
  return [
    { $match: { projectId } },
    { $sort: { createdAt: -1 } },
    // 이 프로젝트의 제출에 달린 댓글만 붙인다 (제출마다 따로 조회하지 않는다 = N+1 방지)
    {
      $lookup: {
        from: commentCollection,
        localField: "_id",
        foreignField: "submissionId",
        pipeline: [{ $project: { _id: 0, tag: 1, parentId: 1, resolved: 1 } }],
        as: "comments",
      },
    },
    {
      $project: {
        title: 1,
        author: 1,
        status: 1,
        createdAt: 1,
        // 배지 숫자는 "해결 안 된 원댓글"만 센다 (답글과 해결된 댓글은 제외)
        commentCount: { $size: { $filter: { input: "$comments", cond: OPEN_ROOT } } },
        bugCount: { $size: { $filter: { input: "$comments", cond: { $and: [OPEN_ROOT, { $eq: ["$$this.tag", "BUG"] }] } } } },
        totalComments: { $size: "$comments" },
        hasWarning: { $gt: [{ $strLenCP: { $ifNull: ["$aiReport.warning", ""] } }, 0] },
      },
    },
  ];
}

// DB 행 → 화면에 넘길 값 (날짜는 ISO 문자열로, 빠진 숫자는 0으로)
export function toSubmissionItem(row: SubmissionRow): SubmissionItem {
  return {
    id: String(row._id),
    title: row.title,
    author: row.author,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    commentCount: row.commentCount ?? 0,
    bugCount: row.bugCount ?? 0,
    hasWarning: row.hasWarning ?? false,
    totalComments: row.totalComments ?? 0,
  };
}

// 호출하는 쪽에서 findMember로 멤버 확인을 마친 프로젝트의 _id만 넘겨야 한다
export async function listSubmissions(projectId: Types.ObjectId): Promise<SubmissionItem[]> {
  const rows = await Submission.aggregate<SubmissionRow>(submissionListPipeline(projectId, Comment.collection.name));
  return rows.map(toSubmissionItem);
}

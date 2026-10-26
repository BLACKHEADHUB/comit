import "server-only";
import type { Types } from "mongoose";
import { Submission } from "@/models/Submission";

// 지금 원본(mainCode)을 만든 "가장 최근 병합"을 찾는다. 되돌리기는 이 제출만 할 수 있다.
// 병합 시각(mergedAt)이 최신인 것 우선, 예전 데이터라 시각이 없으면 작성 시각으로 고른다
export async function findRevertTarget(projectId: Types.ObjectId | string, mainCode: string) {
  return Submission.findOne({ projectId, status: "MERGED", afterCode: mainCode })
    .sort({ mergedAt: -1, createdAt: -1 })
    .select("title beforeCode afterCode")
    .lean();
}

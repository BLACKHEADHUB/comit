import "server-only";
import type { Types } from "mongoose";
import type { CommentItem } from "@/lib/validation";
import { Comment } from "@/models/Comment";

// 한 제출의 댓글을 작성 시간순으로 가져온다.
// 호출하는 쪽에서 반드시 projectId로 검증한 제출의 _id만 넘겨야 한다 (멀티테넌시 격리)
export async function listComments(submissionId: Types.ObjectId): Promise<CommentItem[]> {
  const docs = await Comment.find({ submissionId }).sort({ createdAt: 1 }).lean();
  return docs.map((c) => ({
    id: String(c._id),
    author: c.author,
    lineNumber: c.lineNumber,
    tag: c.tag,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
  }));
}

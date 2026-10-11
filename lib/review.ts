import "server-only";
import type { Types } from "mongoose";
import type { CommentItem } from "@/lib/validation";
import { Comment } from "@/models/Comment";

// 한 제출의 댓글을 작성 시간순으로 가져온다.
// 호출하는 쪽에서 반드시 projectId로 검증한 제출의 _id만 넘겨야 한다 (멀티테넌시 격리)
// DB 문서 → 화면에 넘길 값. 예전 댓글에는 parentId/resolved가 없으므로 기본값으로 채운다
export function toCommentItem(c: {
  _id: unknown;
  author: string;
  lineNumber: number;
  tag?: CommentItem["tag"];
  content?: string | null;
  createdAt: Date;
  parentId?: unknown;
  resolved?: boolean | null;
}): CommentItem {
  return {
    id: String(c._id),
    author: c.author,
    lineNumber: c.lineNumber,
    tag: c.tag ?? null,
    content: c.content ?? "",
    createdAt: c.createdAt.toISOString(),
    parentId: c.parentId ? String(c.parentId) : null,
    resolved: c.resolved === true,
  };
}

export async function listComments(submissionId: Types.ObjectId): Promise<CommentItem[]> {
  const docs = await Comment.find({ submissionId }).sort({ createdAt: 1 }).lean();
  return docs.map(toCommentItem);
}

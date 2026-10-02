"use server";

import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getMemberId } from "@/lib/session";
import { createCommentSchema, type CommentResult } from "@/lib/validation";
import { Comment } from "@/models/Comment";
import { Project } from "@/models/Project";
import { Submission } from "@/models/Submission";

// 라인 댓글 작성: lineNumber는 afterCode 기준 줄 번호
export async function createComment(
  projectId: string,
  submissionId: string,
  lineNumber: number,
  tag: string,
  content: string
): Promise<CommentResult> {
  if (!isValidObjectId(projectId) || !isValidObjectId(submissionId)) {
    return { error: "잘못된 요청이에요." };
  }
  const parsed = createCommentSchema.safeParse({ lineNumber, tag, content });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await connectDB();

  // 이 프로젝트의 멤버만 작성 가능 (멀티테넌시 격리)
  const memberId = await getMemberId(projectId);
  const project = await Project.findOne({ _id: projectId, "members._id": memberId }).lean();
  const me = project?.members.find((m) => String(m._id) === memberId);
  if (!project || !me) return { error: "이 프로젝트의 멤버만 댓글을 쓸 수 있어요." };

  // projectId까지 걸어 조회 → 다른 프로젝트의 제출에는 댓글을 달 수 없다
  const submission = await Submission.findOne({ _id: submissionId, projectId: project._id })
    .select("afterCode")
    .lean();
  if (!submission) return { error: "제출을 찾을 수 없어요." };

  // 존재하지 않는 줄에는 댓글을 달 수 없다
  if (parsed.data.lineNumber > submission.afterCode.split("\n").length) {
    return { error: "존재하지 않는 줄이에요." };
  }

  const comment = await Comment.create({
    submissionId: submission._id,
    author: me.nickname, // 작성자는 클라이언트 값이 아니라 DB의 닉네임
    lineNumber: parsed.data.lineNumber,
    tag: parsed.data.tag,
    content: parsed.data.content,
  });

  return {
    comment: {
      id: String(comment._id),
      author: comment.author,
      lineNumber: comment.lineNumber,
      tag: comment.tag,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    },
  };
}

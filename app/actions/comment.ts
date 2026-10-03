"use server";

import { isValidObjectId } from "mongoose";
import { findMember } from "@/lib/auth";
import { canResolve } from "@/lib/comments";
import { toCommentItem } from "@/lib/review";
import { createCommentSchema, createReplySchema, type CommentResult } from "@/lib/validation";
import { Comment } from "@/models/Comment";
import { Submission } from "@/models/Submission";

// 라인 댓글 작성: lineNumber는 afterCode 기준 줄 번호
export async function createComment(
  projectId: string,
  submissionId: string,
  lineNumber: number,
  tag: string,
  content: string,
): Promise<CommentResult> {
  if (!isValidObjectId(projectId) || !isValidObjectId(submissionId)) {
    return { error: "잘못된 요청이에요." };
  }
  const parsed = createCommentSchema.safeParse({ lineNumber, tag, content });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 이 프로젝트의 멤버만 작성 가능 (멀티테넌시 격리)
  const member = await findMember(projectId);
  if (!member) return { error: "이 프로젝트의 멤버만 댓글을 쓸 수 있어요." };
  const { project, me } = member;

  // projectId까지 걸어 조회 → 다른 프로젝트의 제출에는 댓글을 달 수 없다
  const submission = await Submission.findOne({
    _id: submissionId,
    projectId: project._id,
  })
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

  return { comment: toCommentItem(comment) };
}

// 답글 작성: 원댓글 아래에 태그 없이 내용만 단다 (답글의 답글은 만들 수 없다)
export async function createReply(
  projectId: string,
  submissionId: string,
  parentId: string,
  content: string,
): Promise<CommentResult> {
  if (!isValidObjectId(projectId) || !isValidObjectId(submissionId) || !isValidObjectId(parentId)) {
    return { error: "잘못된 요청이에요." };
  }
  const parsed = createReplySchema.safeParse({ content });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 이 프로젝트의 멤버만 작성 가능 (멀티테넌시 격리)
  const member = await findMember(projectId);
  if (!member) return { error: "이 프로젝트의 멤버만 답글을 쓸 수 있어요." };
  const { project, me } = member;

  // projectId까지 걸어 조회 → 다른 프로젝트의 제출에는 답글을 달 수 없다
  const submission = await Submission.findOne({ _id: submissionId, projectId: project._id }).select("_id").lean();
  if (!submission) return { error: "제출을 찾을 수 없어요." };

  // 원댓글은 반드시 이 제출의 댓글이어야 하고, 답글이 아니어야 한다 (1단계까지만)
  const parent = await Comment.findOne({ _id: parentId, submissionId: submission._id }).select("lineNumber parentId").lean();
  if (!parent) return { error: "댓글을 찾을 수 없어요." };
  if (parent.parentId) return { error: "답글에는 답글을 달 수 없어요." };

  const reply = await Comment.create({
    submissionId: submission._id,
    author: me.nickname, // 작성자는 클라이언트 값이 아니라 DB의 닉네임
    lineNumber: parent.lineNumber, // 줄 번호는 원댓글을 따른다
    content: parsed.data.content,
    parentId: parent._id,
  });

  return { comment: toCommentItem(reply) };
}

// 해결 처리 / 다시 열기: 댓글 작성자, 제출 작성자, 팀장만 가능 (서버에서 확인)
export async function setCommentResolved(
  projectId: string,
  submissionId: string,
  commentId: string,
  resolved: boolean,
): Promise<CommentResult> {
  if (!isValidObjectId(projectId) || !isValidObjectId(submissionId) || !isValidObjectId(commentId)) {
    return { error: "잘못된 요청이에요." };
  }
  if (typeof resolved !== "boolean") return { error: "잘못된 요청이에요." };

  const member = await findMember(projectId);
  if (!member) return { error: "이 프로젝트의 멤버만 할 수 있어요." };
  const { project, me } = member;

  // projectId까지 걸어 조회 → 다른 프로젝트의 댓글은 건드릴 수 없다
  const submission = await Submission.findOne({ _id: submissionId, projectId: project._id }).select("author").lean();
  if (!submission) return { error: "제출을 찾을 수 없어요." };

  const comment = await Comment.findOne({ _id: commentId, submissionId: submission._id }).select("author parentId").lean();
  if (!comment) return { error: "댓글을 찾을 수 없어요." };
  if (comment.parentId) return { error: "답글은 해결 처리할 수 없어요." };

  // 역할과 닉네임은 쿠키가 아니라 DB에서 읽은 값으로 판단한다
  if (!canResolve({ nickname: me.nickname, isLeader: me.role === "LEADER" }, comment.author, submission.author)) {
    return { error: "댓글 작성자, 제출 작성자, 팀장만 해결 처리할 수 있어요." };
  }

  const updated = await Comment.findOneAndUpdate(
    { _id: comment._id, submissionId: submission._id },
    { resolved },
    { returnDocument: "after" },
  ).lean();
  if (!updated) return { error: "댓글을 찾을 수 없어요." };

  return { comment: toCommentItem(updated) };
}

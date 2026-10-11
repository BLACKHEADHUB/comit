"use server";

import { isValidObjectId } from "mongoose";
import { askAboutLine, RATE_LIMIT_MESSAGE } from "@/lib/ai";
import { findMember } from "@/lib/auth";
import { allowAiCall } from "@/lib/redis";
import { askAiSchema, type AskAiResult } from "@/lib/validation";
import { Submission } from "@/models/Submission";
import { BAD_REQUEST_MESSAGE, NOT_MEMBER_MESSAGE, SUBMISSION_GONE_MESSAGE } from "@/lib/ui";

// AI에게 질문하기: Diff의 한 줄에 대해 짧은 답을 받는다. 답변은 DB에 저장하지 않고 화면에만 돌려준다
export async function askAi(projectId: string, submissionId: string, lineNumber: number, question: string): Promise<AskAiResult> {
  if (!isValidObjectId(projectId) || !isValidObjectId(submissionId)) return { error: BAD_REQUEST_MESSAGE };

  const parsed = askAiSchema.safeParse({ lineNumber, question });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 이 프로젝트의 멤버만 질문할 수 있다 (멀티테넌시 격리)
  const member = await findMember(projectId);
  if (!member) return { error: NOT_MEMBER_MESSAGE };
  const { project, me } = member;

  // projectId까지 걸어 조회 → 다른 프로젝트의 제출 내용은 AI에 보낼 수 없다
  const submission = await Submission.findOne({ _id: submissionId, projectId: project._id }).select("beforeCode afterCode").lean();
  if (!submission) return { error: SUBMISSION_GONE_MESSAGE };
  if (parsed.data.lineNumber > submission.afterCode.split("\n").length) return { error: "존재하지 않는 줄이에요." };

  // 제출 분석과 같은 한도(프로젝트+작성자 기준 분당 5회)를 함께 쓴다
  if (!(await allowAiCall(String(project._id), me.nickname))) return { error: RATE_LIMIT_MESSAGE };

  // askAboutLine은 실패해도 예외 대신 기본 답변을 돌려준다 (try-catch + 타임아웃 + zod 검증은 그 안에 있다)
  const answer = await askAboutLine(submission.beforeCode, submission.afterCode, parsed.data.lineNumber, parsed.data.question);
  return { answer };
}

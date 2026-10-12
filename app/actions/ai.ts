"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { analyzeSubmission, askAboutLine, buildDiff, FALLBACK_REPORT, RATE_LIMIT_MESSAGE } from "@/lib/ai";
import { AI_FAILED_LINE, AI_SKIPPED_LINE, aiUnavailableReason } from "@/lib/aiReport";
import { findMember } from "@/lib/auth";
import { allowAiCall, cacheKeyForDiff, getCachedReport, setCachedReport } from "@/lib/redis";
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

export type RetryAiResult = { error?: string };

// AI 분석 다시 시도: 분석이 실패했거나 건너뛴 제출만 다시 분석해서 리포트를 바꿔 저장한다.
// 정상 분석이 이미 있으면 아무것도 하지 않는다 (남이 먼저 다시 시도해 성공한 경우 덮어쓰지 않도록)
export async function retryAiReport(projectId: string, submissionId: string): Promise<RetryAiResult> {
  if (!isValidObjectId(projectId) || !isValidObjectId(submissionId)) return { error: BAD_REQUEST_MESSAGE };

  const member = await findMember(projectId);
  if (!member) return { error: NOT_MEMBER_MESSAGE };
  const { project, me } = member;

  // projectId까지 걸어 조회 → 다른 프로젝트의 제출은 다시 분석할 수 없다
  const submission = await Submission.findOne({ _id: submissionId, projectId: project._id }).select("beforeCode afterCode aiReport").lean();
  if (!submission) return { error: SUBMISSION_GONE_MESSAGE };
  if (!aiUnavailableReason(submission.aiReport?.summary ?? [])) return {};

  // 같은 diff를 성공한 적이 있으면 캐시를 쓰고, 아니면 제출 때와 같은 한도(분당 5회)를 거쳐 AI를 부른다
  const cacheKey = cacheKeyForDiff(buildDiff(submission.beforeCode, submission.afterCode));
  let aiReport = await getCachedReport(cacheKey);
  if (!aiReport) {
    if (!(await allowAiCall(String(project._id), me.nickname))) return { error: RATE_LIMIT_MESSAGE };
    aiReport = await analyzeSubmission(submission.beforeCode, submission.afterCode);
    // 또 실패하면 저장하지 않고 알려준다 (실패 리포트로 덮어써 봐야 달라지는 게 없다)
    if (aiReport === FALLBACK_REPORT) return { error: "AI가 아직 응답하지 않아요. 잠시 뒤에 다시 눌러주세요." };
    await setCachedReport(cacheKey, aiReport);
  }

  // 아직 "분석 못 함" 상태일 때만 바꾼다 (조건부 업데이트)
  await Submission.updateOne(
    { _id: submission._id, projectId: project._id, "aiReport.summary": { $in: [AI_FAILED_LINE, AI_SKIPPED_LINE] } },
    { aiReport }
  );
  revalidatePath(`/project/${projectId}`, "layout");
  return {};
}

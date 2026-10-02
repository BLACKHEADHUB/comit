"use server";

import { isValidObjectId } from "mongoose";
import { analyzeSubmission } from "@/lib/ai";
import { connectDB } from "@/lib/db";
import { getMemberId } from "@/lib/session";
import { createSubmissionSchema, type MergeResult, type SubmissionResult } from "@/lib/validation";
import { Project } from "@/models/Project";
import { Submission } from "@/models/Submission";

// [Comit하기]: 현재 mainCode를 beforeCode로 고정해 Submission을 만든다
export async function createSubmission(
  projectId: string,
  title: string,
  afterCode: string
): Promise<SubmissionResult> {
  if (!isValidObjectId(projectId)) return { error: "잘못된 프로젝트예요." };

  const parsed = createSubmissionSchema.safeParse({ title, afterCode });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await connectDB();

  // 쿠키의 멤버 _id가 이 프로젝트의 멤버일 때만 허용 (멀티테넌시 격리)
  const memberId = await getMemberId(projectId);
  const project = await Project.findOne({ _id: projectId, "members._id": memberId }).lean();
  const me = project?.members.find((m) => String(m._id) === memberId);
  if (!project || !me) return { error: "이 프로젝트의 멤버만 제출할 수 있어요." };

  if (parsed.data.afterCode === project.mainCode) {
    return { error: "변경된 내용이 없어요. 코드를 수정한 뒤 제출해주세요." };
  }

  // beforeCode는 클라이언트 값이 아니라 서버가 조회한 최신 mainCode, 작성자도 DB의 닉네임을 쓴다
  const submission = await Submission.create({
    projectId: project._id,
    author: me.nickname,
    title: parsed.data.title,
    beforeCode: project.mainCode,
    afterCode: parsed.data.afterCode,
    status: "PENDING",
  });

  // 제출은 이미 저장됐으므로, AI가 실패해도(fallback 반환) 흐름은 계속된다
  const aiReport = await analyzeSubmission(project.mainCode, parsed.data.afterCode);
  await Submission.updateOne({ _id: submission._id, projectId: project._id }, { aiReport });

  return {
    submission: {
      id: String(submission._id),
      title: submission.title,
      author: submission.author,
      status: submission.status,
      createdAt: submission.createdAt.toISOString(),
    },
  };
}

// 병합: 제출 당시 mainCode(beforeCode)가 그대로일 때만 mainCode를 덮어쓴다 (조건부 원자적 업데이트)
export async function mergeSubmission(projectId: string, submissionId: string): Promise<MergeResult> {
  if (!isValidObjectId(projectId) || !isValidObjectId(submissionId)) {
    return { error: "잘못된 요청이에요." };
  }

  await connectDB();

  // 쿠키의 멤버가 이 프로젝트의 LEADER인지 DB에서 확인 (역할은 쿠키를 믿지 않는다)
  const memberId = await getMemberId(projectId);
  const project = await Project.findOne({ _id: projectId, "members._id": memberId }).select("members").lean();
  const me = project?.members.find((m) => String(m._id) === memberId);
  if (!project || !me) return { error: "이 프로젝트의 멤버만 접근할 수 있어요." };
  if (me.role !== "LEADER") return { error: "팀장만 병합할 수 있어요." };

  // projectId 필터로 다른 프로젝트의 제출은 조회되지 않는다
  const submission = await Submission.findOne({ _id: submissionId, projectId: project._id }).lean();
  if (!submission) return { error: "제출을 찾을 수 없어요." };
  if (submission.status !== "PENDING") {
    return { status: submission.status, message: "이미 처리된 제출이에요." };
  }

  // 핵심: mainCode가 beforeCode와 같을 때만 덮어쓴다. 그 사이 다른 병합이 있었다면 null
  const merged = await Project.findOneAndUpdate(
    { _id: project._id, mainCode: submission.beforeCode },
    { mainCode: submission.afterCode }
  );

  // 상태 변경도 PENDING일 때만: 같은 제출을 동시에 병합해도 MERGED가 STALE로 덮어써지지 않는다
  const pendingFilter = { _id: submission._id, projectId: project._id, status: "PENDING" as const };

  if (merged) {
    await Submission.updateOne(pendingFilter, { status: "MERGED" });
    return { status: "MERGED", message: "병합 완료! 메인 코드가 업데이트됐어요." };
  }

  await Submission.updateOne(pendingFilter, { status: "STALE" });
  // 동시 요청으로 방금 다른 요청이 이 제출을 병합했는지 최종 상태를 다시 확인한다
  const latest = await Submission.findOne({ _id: submission._id, projectId: project._id }).select("status").lean();
  if (latest?.status === "MERGED") return { status: "MERGED", message: "이미 병합된 제출이에요." };

  return { status: "STALE", message: "다른 변경이 먼저 병합됐어요. 최신 코드로 다시 Comit해주세요" };
}

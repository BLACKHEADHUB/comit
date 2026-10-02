"use server";

import mongoose, { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { analyzeSubmission, buildDiff, FALLBACK_REPORT, RATE_LIMIT_MESSAGE, RATE_LIMITED_REPORT } from "@/lib/ai";
import { allowAiCall, cacheKeyForDiff, getCachedReport, setCachedReport } from "@/lib/redis";
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
  let notice: string | undefined;
  const cacheKey = cacheKeyForDiff(buildDiff(project.mainCode, parsed.data.afterCode));
  let aiReport = await getCachedReport(cacheKey); // 같은 diff는 24시간 동안 캐시 결과를 재사용
  if (!aiReport) {
    if (await allowAiCall(String(project._id), me.nickname)) {
      aiReport = await analyzeSubmission(project.mainCode, parsed.data.afterCode);
      // 성공한 결과만 캐싱한다. 실패(fallback)를 캐싱하면 같은 코드가 계속 분석 없이 저장되기 때문
      if (aiReport !== FALLBACK_REPORT) await setCachedReport(cacheKey, aiReport);
    } else {
      aiReport = RATE_LIMITED_REPORT; // 한도 초과: 제출은 만들되 AI 분석은 생략
      notice = RATE_LIMIT_MESSAGE;
    }
  }
  await Submission.updateOne({ _id: submission._id, projectId: project._id }, { aiReport });

  return {
    notice,
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

  // 트랜잭션 안에서 mainCode 갱신과 status 변경을 함께 처리한다 (중간에 끊기면 둘 다 취소 → 불일치 없음)
  // 동시에 두 요청이 오면 늦은 쪽은 write conflict로 자동 재시도되고, 재시도 때는 mainCode가 바뀌어 있어 STALE이 된다
  const outcome = await mongoose.connection.transaction(async (session) => {
    // 핵심: mainCode가 beforeCode와 같을 때만 덮어쓴다. 그 사이 다른 병합이 있었다면 null
    const merged = await Project.findOneAndUpdate(
      { _id: project._id, mainCode: submission.beforeCode },
      { mainCode: submission.afterCode },
      { session }
    );

    // 상태 변경은 PENDING일 때만: 같은 제출이 이미 처리됐다면 아무것도 바뀌지 않는다
    const updated = await Submission.updateOne(
      { _id: submission._id, projectId: project._id, status: "PENDING" },
      { status: merged ? "MERGED" : "STALE" },
      { session }
    );
    if (updated.modifiedCount === 0) {
      // 이미 다른 요청이 처리한 제출 → 방금 한 mainCode 변경도 취소(롤백)
      throw new AlreadyHandledError();
    }
    return merged ? ("MERGED" as const) : ("STALE" as const);
  }).catch(async (error) => {
    if (!(error instanceof AlreadyHandledError)) throw error;
    return null;
  });

  // 병합 결과가 화면(프로젝트 메인/상세)에 바로 반영되도록 캐시를 비운다
  revalidatePath(`/project/${projectId}`, "layout");

  if (outcome === "MERGED") return { status: "MERGED", message: "병합 완료! 메인 코드가 업데이트됐어요." };
  if (outcome === "STALE") {
    return { status: "STALE", message: "다른 변경이 먼저 병합됐어요. 최신 코드로 다시 Comit해주세요" };
  }

  // 동시 요청으로 다른 요청이 먼저 처리한 경우: 최종 상태를 다시 읽어 알려준다
  const latest = await Submission.findOne({ _id: submission._id, projectId: project._id }).select("status").lean();
  return { status: latest?.status ?? "STALE", message: "이미 처리된 제출이에요." };
}

// 트랜잭션을 롤백시키기 위한 내부용 에러
class AlreadyHandledError extends Error {}

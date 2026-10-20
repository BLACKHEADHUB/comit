"use server";

import mongoose, { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { FALLBACK_SUMMARY } from "@/lib/aiReport";
import { touchProject } from "@/lib/projectActivity";
import { findMember } from "@/lib/auth";
import { initialStatusFor } from "@/lib/changes";
import type { AIReport } from "@/lib/ai";
import { createSubmissionSchema, MAX_SUBMISSIONS_PER_PROJECT, type MergeResult, type SubmissionResult } from "@/lib/validation";
import { Project } from "@/models/Project";
import { Submission } from "@/models/Submission";
import { BAD_REQUEST_MESSAGE, NOT_MEMBER_MESSAGE, RETRY_MESSAGE, STALE_ON_SUBMIT_MESSAGE, SUBMISSION_GONE_MESSAGE } from "@/lib/ui";

// [Comit하기]: 에디터를 열었을 때의 원본을 beforeCode로 고정해 Submission을 만든다
// baseCode: 에디터가 처음 받은 원본. 그 사이 원본이 바뀌었다면 이 코드는 옛 원본 기준이라, 병합하지 못하게 "다시 제출 필요"로 올린다
export async function createSubmission(
  projectId: string,
  title: string,
  afterCode: string,
  baseCode: string
): Promise<SubmissionResult> {
  if (!isValidObjectId(projectId)) return { error: BAD_REQUEST_MESSAGE };

  const parsed = createSubmissionSchema.safeParse({ title, afterCode, baseCode });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 어느 단계에서 실패했는지 알 수 있도록 단계를 기록한다 (운영 중 "문제가 생겼어요"의 원인을 찾기 위해)
  let stage = "시작";
  try {
    // 이 프로젝트의 멤버만 제출할 수 있다 (멀티테넌시 격리)
    stage = "멤버 확인";
    const member = await findMember(projectId);
    if (!member) return { error: NOT_MEMBER_MESSAGE };
    const { project, me } = member;

    // 내가 연 원본과도, 지금 원본과도 같다면 바뀐 게 없는 제출이다
    if (parsed.data.afterCode === project.mainCode || parsed.data.afterCode === parsed.data.baseCode) {
      return { error: "변경된 내용이 없어요. 코드를 수정한 뒤 제출해주세요." };
    }

    // 에디터를 연 뒤 다른 변경이 먼저 병합됐다면, 내 코드는 옛 원본 기준이다.
    // 이걸 지금 원본에 그대로 두면 병합 때 먼저 병합된 변경이 지워지므로, 처음부터 "다시 제출 필요"로 올린다
    // (beforeCode는 내가 실제로 고친 기준 원본. 병합은 beforeCode가 지금 원본과 같을 때만 되므로 여기서 덮어쓰기는 일어나지 않는다)
    const status = initialStatusFor(parsed.data.baseCode, project.mainCode);

    // 도배 방지: 프로젝트+작성자 기준 분당 10회, IP 기준 하루 100회까지 (Redis가 없으면 건너뛴다)
    const { allowSubmit, allowSubmitFromIp } = await import("@/lib/redis");
    if (!(await allowSubmit(String(project._id), me.nickname))) {
      return { error: "제출이 너무 잦아요. 잠시 후 다시 시도해주세요." };
    }
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!(await allowSubmitFromIp(ip))) return { error: "오늘 제출할 수 있는 횟수를 모두 썼어요. 내일 다시 시도해주세요." };

    // 프로젝트당 제출 개수 상한 (저장 공간 보호). 쓰지 않는 제출은 정리 기능이 생기기 전까지 쌓인다
    stage = "제출 개수 확인";
    if ((await Submission.countDocuments({ projectId: project._id })) >= MAX_SUBMISSIONS_PER_PROJECT) {
      return { error: `이 프로젝트에는 제출을 ${MAX_SUBMISSIONS_PER_PROJECT}개까지 쌓을 수 있어요. 새 프로젝트를 만들어 이어가 주세요.` };
    }

    // 같은 사람이 똑같은 코드를 아직 대기 중으로 올려뒀다면 또 만들지 않는다
    const duplicate = await Submission.exists({
      projectId: project._id,
      author: me.nickname,
      status: "PENDING",
      beforeCode: parsed.data.baseCode,
      afterCode: parsed.data.afterCode,
    });
    if (duplicate) return { error: "같은 내용의 제출이 이미 있어요." };

    stage = "제출 저장";
    // 작성자는 DB의 닉네임을 쓴다
    const submission = await Submission.create({
      projectId: project._id,
      author: me.nickname,
      title: parsed.data.title,
      beforeCode: parsed.data.baseCode,
      afterCode: parsed.data.afterCode,
      status,
    });

    await touchProject(project._id); // 마지막 활동 기록 (정리 대상에서 제외되는 기준)

    // 제출은 이미 저장됐으므로, AI 분석이 어떻게 실패하든 제출 흐름은 계속된다
    stage = "AI 분석";
    const { aiReport, notice } = await analyzeForSubmission(String(project._id), me.nickname, parsed.data.baseCode, parsed.data.afterCode);
    stage = "분석 결과 저장";
    await Submission.updateOne({ _id: submission._id, projectId: project._id }, { aiReport });

    return {
      notice: status === "STALE" ? [STALE_ON_SUBMIT_MESSAGE, notice].filter(Boolean).join(" ") : notice,
      submission: {
        id: String(submission._id),
        title: submission.title,
        author: submission.author,
        status: submission.status,
        createdAt: submission.createdAt.toISOString(),
        // 방금 만든 제출이라 댓글은 아직 없다
        commentCount: 0,
        bugCount: 0,
        hasWarning: Boolean(aiReport.warning),
        totalComments: 0,
      },
    };
  } catch (error) {
    // 비밀값이 섞일 수 있는 상세 메시지는 서버 로그에만, 화면에는 단계와 오류 종류만 보여준다
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`[제출] "${stage}" 단계 실패:`, error instanceof Error ? `${name}: ${error.message}`.slice(0, 300) : "unknown");
    return { error: `${RETRY_MESSAGE} (오류 코드: ${stage} / ${name})` };
  }
}

// AI 분석(캐시 확인 → 요청 한도 확인 → Gemini 호출). 어떤 이유로 실패해도 예외를 던지지 않고 기본 리포트를 돌려준다.
// AI/Redis 모듈은 여기서 불러온다: 이 모듈들을 못 불러오는 환경이어도 제출 자체는 막히지 않게 하기 위해서다
async function analyzeForSubmission(
  projectId: string,
  nickname: string,
  beforeCode: string,
  afterCode: string
): Promise<{ aiReport: AIReport; notice?: string }> {
  try {
    const { analyzeSubmission, buildDiff, FALLBACK_REPORT, RATE_LIMIT_MESSAGE, RATE_LIMITED_REPORT } = await import("@/lib/ai");
    const { allowAiCall, cacheKeyForDiff, getCachedReport, setCachedReport } = await import("@/lib/redis");

    const cacheKey = cacheKeyForDiff(buildDiff(beforeCode, afterCode));
    const cached = await getCachedReport(cacheKey); // 같은 diff는 24시간 동안 캐시 결과를 재사용
    if (cached) return { aiReport: cached };

    if (!(await allowAiCall(projectId, nickname))) {
      // 한도 초과: 제출은 만들되 AI 분석은 생략
      return { aiReport: RATE_LIMITED_REPORT, notice: RATE_LIMIT_MESSAGE };
    }
    const aiReport = await analyzeSubmission(beforeCode, afterCode);
    // 성공한 결과만 캐싱한다. 실패(fallback)를 캐싱하면 같은 코드가 계속 분석 없이 저장되기 때문
    if (aiReport !== FALLBACK_REPORT) await setCachedReport(cacheKey, aiReport);
    return { aiReport };
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`[제출] AI 분석 단계 예외: ${name}: ${error instanceof Error ? error.message.slice(0, 300) : "unknown"}`);
    return { aiReport: { summary: [...FALLBACK_SUMMARY], warning: "", concept: "" } };
  }
}

// 병합: 제출 당시 mainCode(beforeCode)가 그대로일 때만 mainCode를 덮어쓴다 (조건부 원자적 업데이트)
export async function mergeSubmission(projectId: string, submissionId: string): Promise<MergeResult> {
  if (!isValidObjectId(projectId) || !isValidObjectId(submissionId)) {
    return { error: BAD_REQUEST_MESSAGE };
  }

  // 역할(LEADER)은 쿠키를 믿지 않고 DB 기준으로 확인한다
  const member = await findMember(projectId);
  if (!member) return { error: NOT_MEMBER_MESSAGE };
  const { project, me } = member;
  if (me.role !== "LEADER") return { error: "팀장만 병합할 수 있어요." };

  // projectId 필터로 다른 프로젝트의 제출은 조회되지 않는다
  const submission = await Submission.findOne({ _id: submissionId, projectId: project._id }).lean();
  if (!submission) return { error: SUBMISSION_GONE_MESSAGE };
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
    // 병합이 성공하면 원본이 바뀌었으니, 옛 원본 기준의 다른 대기 제출도 바로 "다시 제출 필요"로 바꾼다
    // (안 그러면 목록에 PENDING으로 남아 있다가 병합 버튼을 눌러야만 STALE이 된다)
    if (merged) {
      await Submission.updateMany(
        { projectId: project._id, status: "PENDING", beforeCode: { $ne: submission.afterCode } },
        { status: "STALE" },
        { session }
      );
    }
    return merged ? ("MERGED" as const) : ("STALE" as const);
  }).catch(async (error) => {
    if (!(error instanceof AlreadyHandledError)) throw error;
    return null;
  });

  if (outcome === "MERGED") await touchProject(project._id); // 마지막 활동 기록

  // 병합 결과가 화면(프로젝트 메인/상세)에 바로 반영되도록 캐시를 비운다
  revalidatePath(`/project/${projectId}`, "layout");

  if (outcome === "MERGED") return { status: "MERGED", message: "병합 완료! 잘했어요, 원본이 이 코드로 바뀌었어요." };
  if (outcome === "STALE") {
    return { status: "STALE", message: "다른 변경이 먼저 병합됐어요. 최신 원본을 바탕으로 다시 Comit해주세요." };
  }

  // 동시 요청으로 다른 요청이 먼저 처리한 경우: 최종 상태를 다시 읽어 알려준다
  const latest = await Submission.findOne({ _id: submission._id, projectId: project._id }).select("status").lean();
  return { status: latest?.status ?? "STALE", message: "이미 처리된 제출이에요." };
}

// 트랜잭션을 롤백시키기 위한 내부용 에러
class AlreadyHandledError extends Error {}

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { findMember } from "@/lib/auth";
import { generateClassCode, generateOwnerToken, hashOwnerToken, MAX_PROJECTS_PER_CLASS, normalizeClassCode } from "@/lib/classroom";
import { findClassroomByToken, findClassProject } from "@/lib/classroomAuth";
import { connectDB } from "@/lib/db";
import { BAD_REQUEST_MESSAGE, NOT_MEMBER_MESSAGE, RETRY_MESSAGE } from "@/lib/ui";
import { MAX_CODE_CHARS } from "@/lib/validation";
import { Classroom } from "@/models/Classroom";
import { Project } from "@/models/Project";

const createClassSchema = z.object({
  title: z.string().trim().min(1, "수업 이름을 입력해주세요.").max(50, "수업 이름은 50자 이하로 입력해주세요."),
  instructorName: z.string().trim().max(20, "이름은 20자 이하로 입력해주세요."),
});

const updateClassSchema = createClassSchema.extend({
  assignmentPrompt: z.string().trim().max(500, "과제 안내는 500자 이하로 입력해주세요.").default(""),
  starterCode: z.string().max(MAX_CODE_CHARS, "시작 코드는 3만 자 이하로 입력해주세요.").default(""),
});

export type CreateClassState = { error?: string; ownerUrl?: string; joinCode?: string };

// 수업(반) 만들기: 강사용 비밀 링크와 학생용 반 코드를 돌려준다
export async function createClassroom(_prev: CreateClassState, formData: FormData): Promise<CreateClassState> {
  const parsed = createClassSchema.safeParse({ title: formData.get("title"), instructorName: formData.get("instructorName") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const h = await headers();
  const { allowCreateClass, extractClientIp } = await import("@/lib/redis");
  const ip = extractClientIp(h);
  if (!(await allowCreateClass(ip))) return { error: "수업을 너무 많이 만들었어요. 잠시 후 다시 시도해주세요." };

  try {
    await connectDB();
    const ownerToken = generateOwnerToken();
    // 반 코드가 우연히 이미 쓰이고 있으면 새로 뽑는다 (32^8 가지라 거의 일어나지 않는다)
    for (let attempt = 0; attempt < 3; attempt++) {
      const joinCode = generateClassCode();
      try {
        await Classroom.create({ ...parsed.data, ownerTokenHash: hashOwnerToken(ownerToken), joinCode });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) continue; // unique 인덱스에 걸림
        throw error;
      }
      // 초대 링크와 같은 방식으로 주소를 만든다 (lib/invite.ts)
      const host = h.get("host");
      const proto = h.get("x-forwarded-proto") ?? "http";
      return { ownerUrl: `${proto}://${host}/class/${ownerToken}`, joinCode };
    }
    return { error: RETRY_MESSAGE };
  } catch (error) {
    console.error("[class] 생성 실패", error instanceof Error ? error.name : "unknown");
    return { error: RETRY_MESSAGE };
  }
}

export type ClassLinkResult = {
  error?: string;
  ok?: boolean;
  title?: string;
  instructorName?: string;
  assignmentPrompt?: string;
  appliedStarter?: boolean;
};

// 팀장이 반 코드를 넣어 내 프로젝트를 수업에 연결한다 (강사가 기여도 리포트를 볼 수 있게 된다)
export async function linkProjectToClass(projectId: string, rawCode: string): Promise<ClassLinkResult> {
  try {
    const found = await findMember(projectId);
    if (!found) return { error: NOT_MEMBER_MESSAGE };
    if (found.me.role !== "LEADER") return { error: "팀장만 수업에 연결할 수 있어요." };

    const { allowEntryAttempt, extractClientIp } = await import("@/lib/redis");
    const ip = extractClientIp(await headers());
    if (!(await allowEntryAttempt(ip))) return { error: "시도가 너무 잦아요. 잠시 후 다시 시도해주세요." };

    const joinCode = normalizeClassCode(String(rawCode ?? ""));
    if (!joinCode) return { error: "반 코드 모양이 달라요. 예) K7P2-XQ9M" };

    const classroom = await Classroom.findOne({ joinCode })
      .select({ title: 1, instructorName: 1, assignmentPrompt: 1, starterCode: 1 })
      .lean();
    if (!classroom) return { error: "이 반 코드로 된 수업을 찾지 못했어요. 강사님께 다시 확인해주세요." };
    const linked = await Project.countDocuments({ classroomId: classroom._id });
    if (linked >= MAX_PROJECTS_PER_CLASS) return { error: `이 수업은 팀이 가득 찼어요. (최대 ${MAX_PROJECTS_PER_CLASS}팀)` };

    // 빈 프로젝트가 처음 수업에 연결될 때만 시작 코드를 채워준다 (이미 작성한 코드는 덮어쓰지 않는다)
    const starterCode = classroom.starterCode ?? "";
    const applyStarter = starterCode.length > 0 && !(found.project.mainCode ?? "").trim();
    await Project.updateOne(
      { _id: found.project._id },
      { $set: applyStarter ? { classroomId: classroom._id, mainCode: starterCode } : { classroomId: classroom._id } }
    );
    return {
      ok: true,
      title: classroom.title,
      instructorName: classroom.instructorName,
      assignmentPrompt: classroom.assignmentPrompt ?? "",
      appliedStarter: applyStarter,
    };
  } catch (error) {
    console.error("[class] 연결 실패", error instanceof Error ? error.name : "unknown");
    return { error: RETRY_MESSAGE };
  }
}

// 수업 연결 끊기 (팀장만). 끊으면 강사 화면에서 이 팀이 사라진다
export async function unlinkProjectFromClass(projectId: string): Promise<ClassLinkResult> {
  try {
    const found = await findMember(projectId);
    if (!found) return { error: NOT_MEMBER_MESSAGE };
    if (found.me.role !== "LEADER") return { error: "팀장만 연결을 끊을 수 있어요." };
    await Project.updateOne({ _id: found.project._id }, { $set: { classroomId: null } });
    return { ok: true };
  } catch (error) {
    console.error("[class] 연결 끊기 실패", error instanceof Error ? error.name : "unknown");
    return { error: RETRY_MESSAGE };
  }
}

// 강사용: 수업 이름·강사 이름·과제 안내·시작 코드 수정
export async function updateClassroom(
  token: string,
  title: string,
  instructorName: string,
  assignmentPrompt = "",
  starterCode = ""
): Promise<{ error?: string; ok?: boolean; title?: string; instructorName?: string; assignmentPrompt?: string; starterCode?: string }> {
  const parsed = updateClassSchema.safeParse({ title, instructorName, assignmentPrompt, starterCode });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const classroom = await findClassroomByToken(token);
    if (!classroom) return { error: BAD_REQUEST_MESSAGE };

    await Classroom.updateOne(
      { _id: classroom._id },
      {
        $set: {
          title: parsed.data.title,
          instructorName: parsed.data.instructorName,
          assignmentPrompt: parsed.data.assignmentPrompt,
          starterCode: parsed.data.starterCode,
        },
      }
    );
    revalidatePath(`/class/${token}`);
    return {
      ok: true,
      title: parsed.data.title,
      instructorName: parsed.data.instructorName,
      assignmentPrompt: parsed.data.assignmentPrompt,
      starterCode: parsed.data.starterCode,
    };
  } catch (error) {
    console.error("[class] 정보 수정 실패", error instanceof Error ? error.name : "unknown");
    return { error: RETRY_MESSAGE };
  }
}

// 강사용: 반 코드 재발급 (기존 코드가 외부에 유출됐을 때 새 코드로 교체)
export async function regenerateClassCode(token: string): Promise<{ error?: string; joinCode?: string }> {
  try {
    const classroom = await findClassroomByToken(token);
    if (!classroom) return { error: BAD_REQUEST_MESSAGE };

    for (let attempt = 0; attempt < 3; attempt++) {
      const joinCode = generateClassCode();
      try {
        await Classroom.updateOne({ _id: classroom._id }, { $set: { joinCode } });
        revalidatePath(`/class/${token}`);
        return { joinCode };
      } catch (error) {
        if ((error as { code?: number }).code === 11000) continue;
        throw error;
      }
    }
    return { error: RETRY_MESSAGE };
  } catch (error) {
    console.error("[class] 반 코드 재발급 실패", error instanceof Error ? error.name : "unknown");
    return { error: RETRY_MESSAGE };
  }
}

// 강사용: 비밀 링크 토큰 재발급 (링크가 유출됐을 때 기존 링크를 즉시 무효화한다)
export async function regenerateOwnerToken(token: string): Promise<{ error?: string; newToken?: string }> {
  try {
    const classroom = await findClassroomByToken(token);
    if (!classroom) return { error: BAD_REQUEST_MESSAGE };

    const newToken = generateOwnerToken();
    await Classroom.updateOne({ _id: classroom._id }, { $set: { ownerTokenHash: hashOwnerToken(newToken) } });
    return { newToken };
  } catch (error) {
    console.error("[class] 강사 링크 재발급 실패", error instanceof Error ? error.name : "unknown");
    return { error: RETRY_MESSAGE };
  }
}

// 강사용: 잘못 연결된 팀을 수업에서 연결 해제 (프로젝트 데이터는 지우지 않는다)
export async function unlinkClassProject(token: string, projectId: string): Promise<{ error?: string; ok?: boolean }> {
  try {
    const found = await findClassProject(token, projectId);
    if (!found) return { error: BAD_REQUEST_MESSAGE };

    await Project.updateOne({ _id: found.project._id, classroomId: found.classroom._id }, { $set: { classroomId: null } });
    revalidatePath(`/class/${token}`);
    return { ok: true };
  } catch (error) {
    console.error("[class] 강사 팀 해제 실패", error instanceof Error ? error.name : "unknown");
    return { error: RETRY_MESSAGE };
  }
}

const feedbackSchema = z.string().trim().max(500, "피드백은 500자 이하로 입력해주세요.");

// 강사용: 팀에게 한마디 피드백 남기기 (학생 작업 공간에서 확인할 수 있다)
export async function updateProjectFeedback(
  token: string,
  projectId: string,
  rawFeedback: string
): Promise<{ error?: string; ok?: boolean; feedback?: string; feedbackAt?: string | null }> {
  const parsed = feedbackSchema.safeParse(rawFeedback ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const found = await findClassProject(token, projectId);
    if (!found) return { error: BAD_REQUEST_MESSAGE };

    const now = parsed.data ? new Date() : null;
    await Project.updateOne(
      { _id: found.project._id, classroomId: found.classroom._id },
      { $set: { instructorFeedback: parsed.data, instructorFeedbackAt: now } }
    );
    revalidatePath(`/class/${token}/project/${projectId}`);
    revalidatePath(`/project/${projectId}`);
    return { ok: true, feedback: parsed.data, feedbackAt: now ? now.toISOString() : null };
  } catch (error) {
    console.error("[class] 피드백 저장 실패", error instanceof Error ? error.name : "unknown");
    return { error: RETRY_MESSAGE };
  }
}

"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { findMember } from "@/lib/auth";
import { generateClassCode, generateOwnerToken, hashOwnerToken, MAX_PROJECTS_PER_CLASS, normalizeClassCode } from "@/lib/classroom";
import { connectDB } from "@/lib/db";
import { NOT_MEMBER_MESSAGE, RETRY_MESSAGE } from "@/lib/ui";
import { Classroom } from "@/models/Classroom";
import { Project } from "@/models/Project";

const createClassSchema = z.object({
  title: z.string().trim().min(1, "수업 이름을 입력해주세요.").max(50, "수업 이름은 50자 이하로 입력해주세요."),
  instructorName: z.string().trim().max(20, "이름은 20자 이하로 입력해주세요."),
});

export type CreateClassState = { error?: string; ownerUrl?: string; joinCode?: string };

// 수업(반) 만들기: 강사용 비밀 링크와 학생용 반 코드를 돌려준다
export async function createClassroom(_prev: CreateClassState, formData: FormData): Promise<CreateClassState> {
  const parsed = createClassSchema.safeParse({ title: formData.get("title"), instructorName: formData.get("instructorName") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const h = await headers();
  const { allowCreateClass } = await import("@/lib/redis");
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
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
    console.error("[class] 생성 실패", error);
    return { error: RETRY_MESSAGE };
  }
}

export type ClassLinkResult = { error?: string; ok?: boolean; title?: string; instructorName?: string };

// 팀장이 반 코드를 넣어 내 프로젝트를 수업에 연결한다 (강사가 기여도 리포트를 볼 수 있게 된다)
export async function linkProjectToClass(projectId: string, rawCode: string): Promise<ClassLinkResult> {
  try {
    const found = await findMember(projectId);
    if (!found) return { error: NOT_MEMBER_MESSAGE };
    if (found.me.role !== "LEADER") return { error: "팀장만 수업에 연결할 수 있어요." };
    const joinCode = normalizeClassCode(String(rawCode ?? ""));
    if (!joinCode) return { error: "반 코드 모양이 달라요. 예) K7P2-XQ9M" };

    const classroom = await Classroom.findOne({ joinCode }).select({ title: 1, instructorName: 1 }).lean();
    if (!classroom) return { error: "이 반 코드로 된 수업을 찾지 못했어요. 강사님께 다시 확인해주세요." };
    const linked = await Project.countDocuments({ classroomId: classroom._id });
    if (linked >= MAX_PROJECTS_PER_CLASS) return { error: `이 수업은 팀이 가득 찼어요. (최대 ${MAX_PROJECTS_PER_CLASS}팀)` };

    await Project.updateOne({ _id: found.project._id }, { $set: { classroomId: classroom._id } });
    return { ok: true, title: classroom.title, instructorName: classroom.instructorName };
  } catch (error) {
    console.error("[class] 연결 실패", error);
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
    console.error("[class] 연결 끊기 실패", error);
    return { error: RETRY_MESSAGE };
  }
}

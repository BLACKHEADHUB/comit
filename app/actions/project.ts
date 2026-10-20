"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { buildInviteUrl } from "@/lib/invite";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery";
import { RETRY_MESSAGE } from "@/lib/ui";
import { setMemberCookie, setNewCodeCookie } from "@/lib/session";
import { createProjectSchema, joinProjectSchema, MAX_MEMBERS_PER_PROJECT, type FormState } from "@/lib/validation";
import { Comment } from "@/models/Comment";
import { Project } from "@/models/Project";
import { Submission } from "@/models/Submission";
import { findMember } from "@/lib/auth";
import { deleteMemberCookie } from "@/lib/session";
import { NOT_MEMBER_MESSAGE } from "@/lib/ui";

// 프로젝트 생성: 생성자는 LEADER로 저장
export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createProjectSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 프로젝트 도배 방지: IP 기준 시간당 10개 (Redis가 없으면 건너뛴다)
  const { allowCreateProject } = await import("@/lib/redis");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!(await allowCreateProject(ip))) return { error: "프로젝트를 너무 많이 만들었어요. 잠시 후 다시 시도해주세요." };

  try {
    await connectDB();
  } catch {
    return { error: RETRY_MESSAGE };
  }

  // 16바이트 난수 → 추측이 사실상 불가능한 초대 토큰
  const inviteToken = randomBytes(16).toString("base64url");
  // 복구 코드: 원문은 이 응답으로 한 번만 보여주고, DB에는 해시만 둔다
  const recoveryCode = generateRecoveryCode();
  const project = await Project.create({
    title: parsed.data.title || `${parsed.data.nickname}의 프로젝트`,
    description: parsed.data.description,
    members: [{ nickname: parsed.data.nickname, role: "LEADER", recoveryHash: hashRecoveryCode(recoveryCode) }],
    mainCode: "", // 프로젝트는 항상 빈 코드에서 시작한다
    inviteToken,
  });

  await setMemberCookie(String(project._id), String(project.members[0]._id));
  // 초대 링크를 화면에 보여줘야 하므로 여기서는 redirect하지 않고 결과를 돌려준다
  return { projectId: String(project._id), inviteUrl: await buildInviteUrl(inviteToken), recoveryCode };
}

// 초대 링크로 합류: MEMBER로 저장
export async function joinProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = joinProjectSchema.safeParse({
    token: formData.get("token"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await connectDB();
  } catch {
    return { error: RETRY_MESSAGE };
  }

  // 같은 닉네임이 없을 때만 추가 (조건부 원자적 업데이트로 동시 합류 시 중복 방지)
  const recoveryCode = generateRecoveryCode();
  const project = await Project.findOneAndUpdate(
    {
      inviteToken: parsed.data.token,
      "members.nickname": { $ne: parsed.data.nickname },
      [`members.${MAX_MEMBERS_PER_PROJECT - 1}`]: { $exists: false }, // 멤버 수 상한
    },
    { $push: { members: { nickname: parsed.data.nickname, role: "MEMBER", recoveryHash: hashRecoveryCode(recoveryCode) } } },
    { returnDocument: "after" } // 갱신된 문서를 돌려받는다 (예전 옵션 `new: true`는 mongoose에서 더 이상 권장하지 않는다)
  );

  if (!project) {
    const found = await Project.findOne({ inviteToken: parsed.data.token }).select("members").lean();
    if (found && found.members.length >= MAX_MEMBERS_PER_PROJECT) return { error: `이 프로젝트는 멤버가 가득 찼어요. (최대 ${MAX_MEMBERS_PER_PROJECT}명)` };
    return { error: found ? "이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요." : "유효하지 않은 초대 링크예요." };
  }

  // 방금 추가된 멤버는 배열 마지막
  const me = project.members[project.members.length - 1];
  await setMemberCookie(String(project._id), String(me._id));
  // 복구 코드는 프로젝트 화면 맨 위 안내로 한 번 보여준다 (그래서 쿠키에 잠깐 두고 이동한다)
  await setNewCodeCookie(String(project._id), recoveryCode);
  redirect(`/project/${project._id}`); // redirect는 예외를 던지므로 try-catch 밖에서 호출
}

// 프로젝트 삭제: 팀장만 할 수 있다. 제출·댓글까지 모두 지우며 되돌릴 수 없다
export async function deleteProject(projectId: string, confirmTitle: string): Promise<{ error?: string; ok?: boolean }> {
  try {
    const found = await findMember(projectId);
    if (!found) return { error: NOT_MEMBER_MESSAGE };
    if (found.me.role !== "LEADER") return { error: "팀장만 프로젝트를 삭제할 수 있어요." };
    // 실수 방지: 프로젝트 이름을 똑같이 입력해야 지운다
    if (confirmTitle.trim() !== found.project.title) return { error: "프로젝트 이름이 달라요. 이름을 똑같이 입력해주세요." };

    await connectDB();
    // 댓글 → 제출 → 프로젝트 순서로 지운다 (중간에 실패해도 고아 데이터가 남지 않게 아래부터)
    const ids = (await Submission.find({ projectId: found.project._id }).select("_id").lean()).map((s) => s._id);
    await Comment.deleteMany({ submissionId: { $in: ids } });
    await Submission.deleteMany({ projectId: found.project._id });
    await Project.deleteOne({ _id: found.project._id });
    await deleteMemberCookie(projectId);
    return { ok: true };
  } catch (error) {
    console.error("[project] 삭제 실패", error);
    return { error: RETRY_MESSAGE };
  }
}

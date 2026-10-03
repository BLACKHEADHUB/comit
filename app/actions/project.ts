"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { buildInviteUrl } from "@/lib/invite";
import { RETRY_MESSAGE } from "@/lib/ui";
import { setMemberCookie } from "@/lib/session";
import { createProjectSchema, joinProjectSchema, type FormState } from "@/lib/validation";
import { Project } from "@/models/Project";

// 프로젝트 생성: 생성자는 LEADER로 저장
export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createProjectSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await connectDB();
  } catch {
    return { error: RETRY_MESSAGE };
  }

  // 16바이트 난수 → 추측이 사실상 불가능한 초대 토큰
  const inviteToken = randomBytes(16).toString("base64url");
  const project = await Project.create({
    title: parsed.data.title || `${parsed.data.nickname}의 프로젝트`,
    description: parsed.data.description,
    members: [{ nickname: parsed.data.nickname, role: "LEADER" }],
    inviteToken,
  });

  await setMemberCookie(String(project._id), String(project.members[0]._id));
  // 초대 링크를 화면에 보여줘야 하므로 여기서는 redirect하지 않고 결과를 돌려준다
  return { projectId: String(project._id), inviteUrl: await buildInviteUrl(inviteToken) };
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
  const project = await Project.findOneAndUpdate(
    { inviteToken: parsed.data.token, "members.nickname": { $ne: parsed.data.nickname } },
    { $push: { members: { nickname: parsed.data.nickname, role: "MEMBER" } } },
    { returnDocument: "after" } // 갱신된 문서를 돌려받는다 (예전 옵션 `new: true`는 mongoose에서 더 이상 권장하지 않는다)
  );

  if (!project) {
    const exists = await Project.exists({ inviteToken: parsed.data.token });
    return { error: exists ? "이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요." : "유효하지 않은 초대 링크예요." };
  }

  // 방금 추가된 멤버는 배열 마지막
  const me = project.members[project.members.length - 1];
  await setMemberCookie(String(project._id), String(me._id));
  redirect(`/project/${project._id}`); // redirect는 예외를 던지므로 try-catch 밖에서 호출
}

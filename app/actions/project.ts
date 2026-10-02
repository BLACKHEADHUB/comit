"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
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

  await connectDB();

  // 16바이트 난수 → 추측이 사실상 불가능한 초대 토큰
  const inviteToken = randomBytes(16).toString("base64url");
  const project = await Project.create({
    title: parsed.data.title,
    description: parsed.data.description,
    members: [{ nickname: parsed.data.nickname, role: "LEADER" }],
    inviteToken,
  });

  await setMemberCookie(String(project._id), String(project.members[0]._id));
  redirect(`/p/${project._id}`); // redirect는 예외를 던지므로 try-catch 밖에서 호출
}

// 초대 링크로 합류: MEMBER로 저장
export async function joinProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = joinProjectSchema.safeParse({
    token: formData.get("token"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await connectDB();

  // 같은 닉네임이 없을 때만 추가 (조건부 원자적 업데이트로 동시 합류 시 중복 방지)
  const project = await Project.findOneAndUpdate(
    { inviteToken: parsed.data.token, "members.nickname": { $ne: parsed.data.nickname } },
    { $push: { members: { nickname: parsed.data.nickname, role: "MEMBER" } } },
    { new: true }
  );

  if (!project) {
    const exists = await Project.exists({ inviteToken: parsed.data.token });
    return { error: exists ? "이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요." : "유효하지 않은 초대 링크예요." };
  }

  // 방금 추가된 멤버는 배열 마지막
  const me = project.members[project.members.length - 1];
  await setMemberCookie(String(project._id), String(me._id));
  redirect(`/p/${project._id}`);
}

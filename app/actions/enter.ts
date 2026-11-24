"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { hashRecoveryCode, parseEntry } from "@/lib/recovery";
import { setMemberCookie } from "@/lib/session";
import { RETRY_MESSAGE } from "@/lib/ui";
import type { FormState } from "@/lib/validation";
import { Project } from "@/models/Project";

// 홈 화면 입력칸: 초대 링크/초대 코드면 합류 화면으로, 복구 코드면 내 자리로 바로 돌아간다
export async function enterWithCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const entry = parseEntry(String(formData.get("code") ?? ""));
  if (!entry) return { error: "초대 링크나 복구 코드를 다시 확인해주세요." };

  const { allowEntryAttempt, extractClientIp } = await import("@/lib/redis");
  const ip = extractClientIp(await headers());
  if (!(await allowEntryAttempt(ip))) {
    return { error: "시도가 너무 잦아요. 잠시 후 다시 시도해주세요." };
  }

  try {
    await connectDB();
  } catch {
    return { error: RETRY_MESSAGE };
  }

  if (entry.kind === "invite") {
    const exists = await Project.exists({ inviteToken: entry.token });
    if (!exists) return { error: "유효하지 않은 초대 코드예요. 보낸 사람에게 링크를 다시 받아보세요." };
    redirect(`/invite/${entry.token}`);
  }

  // 복구 코드: 해시로 멤버를 찾아 그 멤버의 쿠키를 다시 만들어준다
  const hash = hashRecoveryCode(entry.code);
  const project = await Project.findOne({ "members.recoveryHash": hash });
  const me = project?.members.find((m) => m.recoveryHash === hash);
  if (!project || !me) return { error: "이 복구 코드를 찾지 못했어요. 코드를 다시 확인해주세요." };

  await setMemberCookie(String(project._id), String(me._id));
  redirect(`/project/${project._id}`); // redirect는 예외를 던지므로 try-catch 밖에서 호출
}

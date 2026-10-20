"use server";

import { findMember } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { clearNewCodeCookie } from "@/lib/session";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery";
import { NOT_MEMBER_MESSAGE, RETRY_MESSAGE } from "@/lib/ui";
import { nicknameSchema } from "@/lib/validation";
import { randomBytes } from "node:crypto";
import { Project } from "@/models/Project";

export type MemberActionResult = { error?: string; recoveryCode?: string; ok?: boolean };

// 내 복구 코드를 새로 만든다 (이전 코드는 바로 쓸 수 없게 된다. 예전에 가입해 코드가 없는 멤버도 여기서 받는다)
export async function reissueRecoveryCode(projectId: string): Promise<MemberActionResult> {
  try {
    const found = await findMember(projectId);
    if (!found) return { error: NOT_MEMBER_MESSAGE };

    const recoveryCode = generateRecoveryCode();
    await Project.updateOne(
      { _id: found.project._id, "members._id": found.me._id },
      { $set: { "members.$.recoveryHash": hashRecoveryCode(recoveryCode) } }
    );
    return { recoveryCode };
  } catch (error) {
    console.error("[member] 복구 코드 재발급 실패", error);
    return { error: RETRY_MESSAGE };
  }
}

// 팀장 넘기기: 팀장만 할 수 있고, 다른 멤버 한 명을 새 팀장으로 세운다
export async function transferLeader(projectId: string, nickname: string): Promise<MemberActionResult> {
  try {
    const found = await findMember(projectId);
    if (!found) return { error: NOT_MEMBER_MESSAGE };
    if (found.me.role !== "LEADER") return { error: "팀장만 팀장을 넘길 수 있어요." };

    // 멤버 _id는 쿠키 값이라 화면에 내보내지 않는다. 닉네임(프로젝트 안에서 겹치지 않음)으로 지목한다
    const parsed = nicknameSchema.safeParse(nickname);
    const target = parsed.success ? found.project.members.find((m) => m.nickname === parsed.data) : undefined;
    if (!target) return { error: "그 멤버를 찾지 못했어요. 화면을 새로고침한 뒤 다시 시도해주세요." };
    if (String(target._id) === String(found.me._id)) return { error: "이미 팀장이에요." };

    await connectDB();
    // 새 팀장을 먼저 세우고 나를 내린다: 중간에 실패해도 팀장이 한 명도 없는 순간이 생기지 않는다
    const promoted = await Project.updateOne(
      { _id: found.project._id, "members._id": target._id },
      { $set: { "members.$.role": "LEADER" } }
    );
    if (promoted.matchedCount === 0) return { error: "그 멤버를 찾지 못했어요. 화면을 새로고침한 뒤 다시 시도해주세요." };
    await Project.updateOne(
      { _id: found.project._id, "members._id": found.me._id },
      { $set: { "members.$.role": "MEMBER" } }
    );
    return { ok: true };
  } catch (error) {
    console.error("[member] 팀장 넘기기 실패", error);
    return { error: RETRY_MESSAGE };
  }
}

// 합류 직후 안내(복구 코드)를 확인했다고 알리면 쿠키의 원문을 지운다
export async function dismissRecoveryNotice(projectId: string): Promise<void> {
  const found = await findMember(projectId);
  if (found) await clearNewCodeCookie(projectId);
}

// 멤버 내보내기: 팀장만, 자기 자신은 안 된다. 내보낸 사람의 제출·댓글은 남고 이름만 그대로 보인다
export async function removeMember(projectId: string, nickname: string): Promise<MemberActionResult> {
  try {
    const found = await findMember(projectId);
    if (!found) return { error: NOT_MEMBER_MESSAGE };
    if (found.me.role !== "LEADER") return { error: "팀장만 멤버를 내보낼 수 있어요." };

    const parsed = nicknameSchema.safeParse(nickname);
    const target = parsed.success ? found.project.members.find((m) => m.nickname === parsed.data) : undefined;
    if (!target) return { error: "그 멤버를 찾지 못했어요. 화면을 새로고침한 뒤 다시 시도해주세요." };
    if (String(target._id) === String(found.me._id)) return { error: "자기 자신은 내보낼 수 없어요." };

    await connectDB();
    // 멤버 목록에서 빠지면 그 사람의 쿠키(멤버 _id)는 더 이상 이 프로젝트에서 통하지 않는다
    await Project.updateOne({ _id: found.project._id }, { $pull: { members: { _id: target._id } } });
    return { ok: true };
  } catch (error) {
    console.error("[member] 멤버 내보내기 실패", error);
    return { error: RETRY_MESSAGE };
  }
}

// 초대 링크 새로 만들기: 팀장만. 이전 링크는 바로 쓸 수 없게 된다 (링크가 잘못 퍼졌을 때)
export async function regenerateInvite(projectId: string): Promise<MemberActionResult> {
  try {
    const found = await findMember(projectId);
    if (!found) return { error: NOT_MEMBER_MESSAGE };
    if (found.me.role !== "LEADER") return { error: "팀장만 초대 링크를 새로 만들 수 있어요." };

    await connectDB();
    await Project.updateOne({ _id: found.project._id }, { $set: { inviteToken: randomBytes(16).toString("base64url") } });
    return { ok: true };
  } catch (error) {
    console.error("[member] 초대 링크 재발급 실패", error);
    return { error: RETRY_MESSAGE };
  }
}

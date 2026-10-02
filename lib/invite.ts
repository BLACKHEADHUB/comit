import "server-only";
import { headers } from "next/headers";

// 초대 링크는 현재 접속한 호스트 기준으로 만든다 (로컬/배포 환경 모두 동작)
export async function buildInviteUrl(inviteToken: string): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}/invite/${inviteToken}`;
}

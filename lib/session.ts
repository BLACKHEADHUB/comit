import "server-only";
import { cookies } from "next/headers";

// 로그인 기능이 생기기 전까지 임시로 쓰는 "현재 사용자" 저장소.
// 프로젝트마다 쿠키를 따로 두어 한 브라우저에서 여러 프로젝트에 다른 닉네임으로 참여할 수 있다.
// 쿠키에는 멤버 _id만 저장하고, 역할(LEADER/MEMBER)은 항상 DB에서 조회한다.
const cookieName = (projectId: string) => `comit_member_${projectId}`;

export async function setMemberCookie(projectId: string, memberId: string) {
  const store = await cookies();
  store.set(cookieName(projectId), memberId, {
    httpOnly: true, // JS에서 읽을 수 없게 (XSS 방어)
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
}

export async function getMemberId(projectId: string): Promise<string | undefined> {
  const store = await cookies();
  return store.get(cookieName(projectId))?.value;
}

// 합류한 직후에만 한 번 보여줄 복구 코드 (원문은 DB에 없으므로 잠깐 쿠키에 둔다. 확인하면 지운다)
const codeCookieName = (projectId: string) => `comit_new_code_${projectId}`;

export async function setNewCodeCookie(projectId: string, code: string) {
  const store = await cookies();
  store.set(codeCookieName(projectId), code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10분 안에 확인하지 않으면 사라진다 (그 뒤에는 멤버 메뉴에서 새로 받는다)
  });
}

export async function getNewCodeCookie(projectId: string): Promise<string | undefined> {
  const store = await cookies();
  return store.get(codeCookieName(projectId))?.value;
}

export async function clearNewCodeCookie(projectId: string) {
  const store = await cookies();
  store.delete(codeCookieName(projectId));
}

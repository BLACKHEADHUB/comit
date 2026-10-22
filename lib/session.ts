import "server-only";
import { cookies } from "next/headers";
import { signMemberValue, verifyMemberValue } from "@/lib/signedCookie";

// 로그인 기능이 생기기 전까지 임시로 쓰는 "현재 사용자" 저장소.
// 프로젝트마다 쿠키를 따로 두어 한 브라우저에서 여러 프로젝트에 다른 닉네임으로 참여할 수 있다.
// 쿠키에는 "멤버 _id + 서버 서명"을 저장하고, 역할(LEADER/MEMBER)은 항상 DB에서 조회한다.
// 서명이 있어서, 남의 멤버 _id를 알거나 추측해도 쿠키를 직접 만들어 그 사람인 척할 수 없다.
const cookieName = (projectId: string) => `comit_member_${projectId}`;

// 서명 비밀값: SESSION_SECRET이 없으면 DB 주소(이미 서버 전용 비밀값)로 대신한다.
// 그래서 환경변수를 새로 넣지 않아도 바로 동작한다. 값을 바꾸면 모두 다시 들어와야 한다(복구 코드로 돌아올 수 있다)
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.MONGODB_URI;
  if (!secret) throw new Error("SESSION_SECRET 또는 MONGODB_URI가 필요합니다.");
  return secret;
}

export async function setMemberCookie(projectId: string, memberId: string) {
  const store = await cookies();
  store.set(cookieName(projectId), signMemberValue(projectId, memberId, sessionSecret()), {
    httpOnly: true, // JS에서 읽을 수 없게 (XSS 방어)
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
}

export async function getMemberId(projectId: string): Promise<string | undefined> {
  const store = await cookies();
  const raw = store.get(cookieName(projectId))?.value;
  // 서명이 맞지 않거나(위조·예전 형식) 다른 프로젝트용이면 "로그인 안 됨"으로 본다
  return raw ? verifyMemberValue(projectId, raw, sessionSecret()) : undefined;
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

// 프로젝트를 지운 뒤 그 프로젝트의 내 쿠키를 비운다
export async function deleteMemberCookie(projectId: string) {
  const store = await cookies();
  store.delete(cookieName(projectId));
  store.delete(codeCookieName(projectId));
}

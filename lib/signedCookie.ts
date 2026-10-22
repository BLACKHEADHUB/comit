import { createHmac, timingSafeEqual } from "node:crypto";

// 멤버 쿠키 서명/검증 (순수 함수라 테스트하기 쉽게 따로 뺐다)
// 쿠키 값 모양: "<멤버 _id>.<서명>". 서명은 프로젝트 id까지 함께 넣어 만들어서,
// 한 프로젝트의 쿠키를 다른 프로젝트 쿠키 자리에 옮겨 붙여도 통하지 않는다.
function sign(projectId: string, memberId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${projectId}:${memberId}`).digest("base64url");
}

export function signMemberValue(projectId: string, memberId: string, secret: string): string {
  return `${memberId}.${sign(projectId, memberId, secret)}`;
}

// 서명이 맞으면 멤버 _id를, 아니면 undefined를 돌려준다
export function verifyMemberValue(projectId: string, value: string, secret: string): string | undefined {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return undefined; // 서명 없는 예전 쿠키
  const memberId = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(projectId, memberId, secret));
  // 길이가 다르면 바로 거절, 같으면 시간 차이로 정답을 추측할 수 없게 비교한다
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
  return memberId;
}

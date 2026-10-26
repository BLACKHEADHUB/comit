import "server-only";

// 운영자 정보 (약관·개인정보 처리방침·바닥글에서 쓴다). 서버 환경변수로만 관리한다
export function operatorInfo() {
  return {
    name: process.env.OPERATOR_NAME?.trim() || "Comit 운영팀",
    email: process.env.CONTACT_EMAIL?.trim() || "", // 비어 있으면 "문의처 준비 중"으로 보여준다
  };
}

// 약관·처리방침을 마지막으로 고친 날 (내용을 바꾸면 이 날짜도 바꾼다)
export const LEGAL_UPDATED = "2026년 10월 22일";

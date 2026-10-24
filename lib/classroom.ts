import { createHash, randomBytes } from "node:crypto";

// 반 코드: 강사가 학생들에게 칠판·단톡방으로 알려주는 짧은 코드. 예) K7P2-XQ9M
// 헷갈리는 글자(0/O, 1/I)는 뺀다 (복구 코드와 같은 글자 집합)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8; // 32^8 ≈ 1조 가지

export function generateClassCode(): string {
  const chars = Array.from(randomBytes(CODE_LENGTH), (b) => ALPHABET[b & 31]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

// 사용자가 입력한 반 코드를 저장 형식으로 맞춘다 (소문자·공백·하이픈 차이는 무시). 형식이 틀리면 null
export function normalizeClassCode(raw: string): string | null {
  const compact = raw.replace(/[\s-]/g, "").toUpperCase();
  if (compact.length !== CODE_LENGTH || ![...compact].every((c) => ALPHABET.includes(c))) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

// 강사용 비밀 링크 토큰 (24바이트 난수). 원문은 만들 때 한 번만 보여주고 DB에는 해시만 둔다
export const generateOwnerToken = () => randomBytes(24).toString("base64url");
export const hashOwnerToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const isOwnerTokenShape = (token: string) => /^[A-Za-z0-9_-]{32}$/.test(token);

// 한 반에 연결할 수 있는 프로젝트 수 (강사 화면이 너무 무거워지지 않게)
export const MAX_PROJECTS_PER_CLASS = 60;

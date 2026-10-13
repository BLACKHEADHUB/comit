import { createHash, randomBytes } from "node:crypto";

// 복구 코드: 쿠키를 잃어버렸을 때 "나"로 돌아오는 열쇠. DB에는 해시만 저장한다 (원문은 만들 때 한 번만 보여준다).
// 헷갈리는 글자(0/O, 1/I)를 뺀 32개 글자를 쓴다. 32개라서 바이트를 & 31 하면 치우침 없이 고른다.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIX = "COMIT";
const BODY_LENGTH = 12; // 32^12 = 60비트: 무작위로 맞히기는 사실상 불가능

// 예) COMIT-K7P2-XQ9M-4TWA
export function generateRecoveryCode(): string {
  const bytes = randomBytes(BODY_LENGTH);
  const chars = Array.from(bytes, (b) => ALPHABET[b & 31]).join("");
  return `${PREFIX}-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export type EntryInput = { kind: "recovery"; code: string } | { kind: "invite"; token: string };

// 홈 화면 입력칸에 들어온 글을 해석한다: 복구 코드 / 초대 링크 / 초대 코드(링크 끝의 난수)
// 대소문자·공백·하이픈이 달라도 복구 코드는 같은 값으로 맞춘다
export function parseEntry(raw: string): EntryInput | null {
  const text = raw.trim();
  if (!text || text.length > 300) return null;

  const compact = text.replace(/[\s-]/g, "").toUpperCase();
  if (compact.startsWith(PREFIX) && compact.length === PREFIX.length + BODY_LENGTH) {
    const body = compact.slice(PREFIX.length);
    if ([...body].every((c) => ALPHABET.includes(c))) {
      return { kind: "recovery", code: `${PREFIX}-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}` };
    }
  }

  // 링크 전체를 붙여넣었다면 /invite/ 뒤의 난수만 꺼낸다
  const marker = "/invite/";
  const at = text.indexOf(marker);
  const token = (at >= 0 ? text.slice(at + marker.length) : text).split(/[/?#\s]/)[0];
  return /^[A-Za-z0-9_-]{1,64}$/.test(token) ? { kind: "invite", token } : null;
}

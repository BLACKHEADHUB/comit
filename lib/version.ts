import { createHash } from "node:crypto";

// 원본(mainCode)이 바뀌었는지 가볍게 비교하기 위한 "버전" 값 (서버에서만 계산한다).
// 자동 갱신 때마다 코드 본문을 통째로 보내지 않고 이 짧은 해시만 보낸다
export function codeVersion(code: string): string {
  return createHash("sha256").update(code).digest("hex").slice(0, 16);
}

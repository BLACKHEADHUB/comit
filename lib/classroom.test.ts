import { describe, expect, it } from "vitest";
import { generateClassCode, generateOwnerToken, hashOwnerToken, isOwnerTokenShape, normalizeClassCode } from "@/lib/classroom";

describe("반 코드", () => {
  it("XXXX-XXXX 모양이고, 헷갈리는 글자가 없다", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateClassCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("소문자·공백·하이픈이 달라도 같은 코드로 맞춘다", () => {
    expect(normalizeClassCode(" k7p2 xq9m ")).toBe("K7P2-XQ9M");
    expect(normalizeClassCode("K7P2XQ9M")).toBe("K7P2-XQ9M");
  });

  it("길이나 글자가 틀리면 null", () => {
    expect(normalizeClassCode("K7P2-XQ9")).toBeNull();
    expect(normalizeClassCode("K7P2-XQ90")).toBeNull(); // 0은 쓰지 않는 글자
    expect(normalizeClassCode("")).toBeNull();
  });
});

describe("강사용 링크 토큰", () => {
  it("32자 URL 안전 문자열이고, 해시는 원문과 다르다", () => {
    const token = generateOwnerToken();
    expect(isOwnerTokenShape(token)).toBe(true);
    expect(hashOwnerToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(isOwnerTokenShape("../etc")).toBe(false);
  });
});

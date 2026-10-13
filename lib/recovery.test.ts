import { describe, expect, it } from "vitest";
import { generateRecoveryCode, hashRecoveryCode, parseEntry } from "@/lib/recovery";

describe("복구 코드", () => {
  it("COMIT-XXXX-XXXX-XXXX 모양이고 매번 다르다", () => {
    const a = generateRecoveryCode();
    expect(a).toMatch(/^COMIT-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(generateRecoveryCode()).not.toBe(a);
  });

  it("같은 코드는 같은 해시, 다른 코드는 다른 해시", () => {
    expect(hashRecoveryCode("COMIT-AAAA-BBBB-CCCC")).toBe(hashRecoveryCode("COMIT-AAAA-BBBB-CCCC"));
    expect(hashRecoveryCode("COMIT-AAAA-BBBB-CCCC")).not.toBe(hashRecoveryCode("COMIT-AAAA-BBBB-CCCD"));
  });
});

describe("parseEntry", () => {
  it("소문자·공백·하이픈이 달라도 복구 코드로 읽는다", () => {
    const code = generateRecoveryCode();
    const messy = ` ${code.toLowerCase().replaceAll("-", " ")} `;
    expect(parseEntry(messy)).toEqual({ kind: "recovery", code });
  });

  it("초대 링크 전체에서 난수만 꺼낸다", () => {
    expect(parseEntry("https://comit-psi.vercel.app/invite/AbC_123-xyz?x=1")).toEqual({ kind: "invite", token: "AbC_123-xyz" });
  });

  it("난수만 붙여넣어도 초대 코드로 읽는다", () => {
    expect(parseEntry("AbC_123-xyz")).toEqual({ kind: "invite", token: "AbC_123-xyz" });
  });

  it("빈 값·이상한 글자·너무 긴 글은 거절한다", () => {
    expect(parseEntry("   ")).toBeNull();
    expect(parseEntry("안녕 하세요!")).toBeNull();
    expect(parseEntry("a".repeat(301))).toBeNull();
  });
});

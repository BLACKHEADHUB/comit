import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, readDraft, readLanguage, subscribeLanguage, writeDraft, writeLanguage } from "@/lib/draft";

// 브라우저의 sessionStorage를 흉내 내는 가짜 저장소
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    size: () => map.size,
  };
}

let storage: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal("sessionStorage", storage);
});

describe("초안 저장", () => {
  it("저장한 초안을 그대로 읽는다", () => {
    writeDraft("p1", { code: "new", base: "main" });
    expect(readDraft("p1", "main")).toEqual({ code: "new", base: "main" });
  });

  it("프로젝트마다 따로 저장한다", () => {
    writeDraft("p1", { code: "new", base: "main" });
    expect(readDraft("p2", "main")).toBeNull();
  });

  it("그 사이 mainCode가 바뀌었으면 초안을 버린다", () => {
    writeDraft("p1", { code: "new", base: "main" });
    expect(readDraft("p1", "main v2")).toBeNull();
    expect(storage.size()).toBe(0);
  });

  it("수정 사항이 없으면 초안을 남기지 않는다", () => {
    writeDraft("p1", { code: "new", base: "main" });
    writeDraft("p1", { code: "main", base: "main" });
    expect(readDraft("p1", "main")).toBeNull();
  });

  it("STALE에서 불러온 코드는 원본과 같아도 남긴다", () => {
    writeDraft("p1", { code: "main", base: "main", fromStale: true });
    expect(readDraft("p1", "main")?.fromStale).toBe(true);
  });

  it("clearDraft로 지운다", () => {
    writeDraft("p1", { code: "new", base: "main" });
    clearDraft("p1");
    expect(readDraft("p1", "main")).toBeNull();
  });

  it("깨진 값이 들어 있어도 에러 없이 null", () => {
    storage.setItem("comit_draft_p1", "{not json");
    expect(readDraft("p1", "main")).toBeNull();
  });

  it("저장소를 못 쓰는 환경에서도 에러를 던지지 않는다", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(readDraft("p1", "main")).toBeNull();
    expect(() => writeDraft("p1", { code: "a", base: "b" })).not.toThrow();
    expect(() => clearDraft("p1")).not.toThrow();
  });
});

describe("언어 선택", () => {
  it("기본값은 일반 텍스트", () => {
    expect(readLanguage("p1")).toBe("plaintext");
  });

  it("저장한 언어를 읽고, 구독자에게 알린다", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLanguage(listener);
    writeLanguage("p1", "python");
    expect(readLanguage("p1")).toBe("python");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    writeLanguage("p1", "html");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("목록에 없는 값이 저장돼 있으면 일반 텍스트로 본다", () => {
    storage.setItem("comit_lang_p1", "cobol");
    expect(readLanguage("p1")).toBe("plaintext");
  });
});

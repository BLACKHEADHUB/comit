import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDraft,
  clearOldDraft,
  hasUnsentDraftEdits,
  readOldDraft,
  readDraft,
  readLanguage,
  readSubmitted,
  subscribeLanguage,
  writeDraft,
  writeLanguage,
  writeSubmitted,
} from "@/lib/draft";

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

  it("그 사이 mainCode가 바뀌었으면 에디터에는 쓰지 않는다 (예전 초안으로 따로 보관)", () => {
    writeDraft("p1", { code: "new", base: "main" });
    expect(readDraft("p1", "main v2")).toBeNull();
    expect(readDraft("p1", "main v2")).toBeNull(); // 다시 읽어도 같다
    expect(readOldDraft("p1", "main v2")).toEqual({ code: "new", base: "main" });
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

describe("아직 Comit하지 않은 수정이 있는지 (덮어쓰기 확인용)", () => {
  it("초안이 없으면 false", () => {
    expect(hasUnsentDraftEdits("p1")).toBe(false);
  });

  it("원본과 다른 새 수정이 있으면 true", () => {
    writeDraft("p1", { code: "내가 쓰던 코드", base: "main" });
    expect(hasUnsentDraftEdits("p1", "가져올 코드")).toBe(true);
  });

  it("원본과 같은(수정 없는) 초안은 false", () => {
    storage.setItem("comit_draft_p1", JSON.stringify({ code: "main", base: "main" }));
    expect(hasUnsentDraftEdits("p1")).toBe(false);
  });

  it("방금 Comit한 코드가 초안으로 남아 있는 경우는 잃을 게 없으니 false", () => {
    writeDraft("p1", { code: "보낸 코드", base: "main" });
    writeSubmitted("p1", { code: "보낸 코드", submissionId: "s1" });
    expect(hasUnsentDraftEdits("p1", "다른 코드")).toBe(false);
  });

  it("가져올 코드와 똑같은 초안은 false", () => {
    writeDraft("p1", { code: "같은 코드", base: "main" });
    expect(hasUnsentDraftEdits("p1", "같은 코드")).toBe(false);
  });

  it("원본이 바뀌어 낡은 초안이어도 사용자의 수정이므로 true (그리고 지우지 않는다)", () => {
    writeDraft("p1", { code: "내가 쓰던 코드", base: "옛 원본" });
    expect(hasUnsentDraftEdits("p1", "가져올 코드")).toBe(true);
    expect(storage.size()).toBe(1);
  });

  it("깨진 값이나 저장소를 못 쓰는 환경에서는 에러 없이 false", () => {
    storage.setItem("comit_draft_p1", "{not json");
    expect(hasUnsentDraftEdits("p1")).toBe(false);
    vi.stubGlobal("sessionStorage", undefined);
    expect(hasUnsentDraftEdits("p1")).toBe(false);
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

describe("방금 Comit한 코드 기억", () => {
  it("저장한 값을 프로젝트별로 읽는다", () => {
    writeSubmitted("p1", { code: "x = 1", submissionId: "s1" });
    expect(readSubmitted("p1")).toEqual({ code: "x = 1", submissionId: "s1" });
    expect(readSubmitted("p2")).toBeNull();
  });

  it("깨진 값이나 모양이 다른 값은 null", () => {
    storage.setItem("comit_submitted_p1", "{oops");
    expect(readSubmitted("p1")).toBeNull();
    storage.setItem("comit_submitted_p1", JSON.stringify({ code: 1 }));
    expect(readSubmitted("p1")).toBeNull();
  });

  it("저장소를 못 쓰는 환경에서도 에러 없이 null", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(readSubmitted("p1")).toBeNull();
    expect(() => writeSubmitted("p1", { code: "a", submissionId: "s" })).not.toThrow();
  });
});

describe("원본이 바뀐 뒤의 예전 초안", () => {
  it("수정이 없던 초안은 보관하지 않는다", () => {
    writeDraft("p1", { code: "main", base: "main", fromStale: true });
    writeDraft("p1", { code: "main", base: "main" }); // 수정 없음 → 초안 삭제
    expect(readDraft("p1", "main v2")).toBeNull();
    expect(readOldDraft("p1", "main v2")).toBeNull();
  });

  it("이미 Comit한 코드는 보관하지 않는다 (잃는 게 없다)", () => {
    writeSubmitted("p1", { code: "new", submissionId: "s1" });
    writeDraft("p1", { code: "new", base: "main" });
    readDraft("p1", "main v2");
    expect(readOldDraft("p1", "main v2")).toBeNull();
  });

  it("원본이 다시 그 초안의 기준과 같아지면 합칠 필요가 없다", () => {
    writeDraft("p1", { code: "new", base: "main" });
    readDraft("p1", "main v2");
    expect(readOldDraft("p1", "main")).toBeNull();
  });

  it("clearOldDraft로 지운다", () => {
    writeDraft("p1", { code: "new", base: "main" });
    readDraft("p1", "main v2");
    clearOldDraft("p1");
    expect(readOldDraft("p1", "main v2")).toBeNull();
  });

  it("프로젝트마다 따로 보관한다", () => {
    writeDraft("p1", { code: "new", base: "main" });
    readDraft("p1", "main v2");
    expect(readOldDraft("p2", "main v2")).toBeNull();
  });
});

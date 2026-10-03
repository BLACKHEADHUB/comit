import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Gemini SDK는 가짜로 바꾼다 (테스트에서 실제 외부 호출을 하지 않는다)
const generateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { aiReportSchema, analyzeSubmission, buildDiff, FALLBACK_REPORT } from "@/lib/ai";

const GOOD = { summary: ["버튼을 추가했어요.", "함수를 고쳤어요.", "주석을 지웠어요."], warning: "", concept: "함수는 코드를 묶어 재사용해요." };

describe("buildDiff", () => {
  it("바뀐 줄만 +/-로 담고, 멀리 떨어진 줄은 보내지 않는다", () => {
    const before = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n");
    const after = before.replace("line 20", "line twenty");
    const diff = buildDiff(before, after);
    expect(diff).toContain("-line 20");
    expect(diff).toContain("+line twenty");
    expect(diff).not.toContain("line 1\n"); // 변경 지점에서 먼 줄(문맥 3줄 밖)은 제외
    expect(diff).not.toContain("line 40");
  });

  it("너무 긴 diff는 12,000자로 자른다", () => {
    const diff = buildDiff("", "x".repeat(50) + "\n".repeat(1) + "y\n".repeat(20_000));
    expect(diff.length).toBe(12_000);
  });

  it("같은 입력이면 같은 결과 (캐시 키로 쓰기 때문)", () => {
    expect(buildDiff("a\n", "b\n")).toBe(buildDiff("a\n", "b\n"));
  });
});

describe("aiReportSchema", () => {
  it("올바른 응답은 통과", () => {
    expect(aiReportSchema.safeParse(GOOD).success).toBe(true);
  });

  it("요약이 3줄이 아니면 거부", () => {
    expect(aiReportSchema.safeParse({ ...GOOD, summary: ["a", "b"] }).success).toBe(false);
    expect(aiReportSchema.safeParse({ ...GOOD, summary: ["a", "b", "c", "d"] }).success).toBe(false);
  });

  it("빈 요약 문장, 빠진 필드, 너무 긴 값은 거부", () => {
    expect(aiReportSchema.safeParse({ ...GOOD, summary: ["a", " ", "c"] }).success).toBe(false);
    expect(aiReportSchema.safeParse({ summary: GOOD.summary, warning: "" }).success).toBe(false);
    expect(aiReportSchema.safeParse({ ...GOOD, warning: "w".repeat(501) }).success).toBe(false);
  });
});

describe("analyzeSubmission", () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "test-model");
    vi.spyOn(console, "error").mockImplementation(() => {}); // 실패 로그로 테스트 출력이 지저분해지지 않게
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("검증을 통과한 응답을 돌려주고, 프롬프트에는 전체 코드가 아니라 diff만 보낸다", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(GOOD) });
    const before = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n");
    const report = await analyzeSubmission(before, before.replace("line 20", "line twenty"));
    expect(report).toEqual(GOOD);

    const prompt = generateContent.mock.calls[0][0].contents as string;
    expect(prompt).toContain("+line twenty");
    expect(prompt).not.toContain("line 40");
  });

  it("환경변수가 없으면 호출하지 않고 기본 리포트", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await analyzeSubmission("a", "b")).toBe(FALLBACK_REPORT);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("JSON이 아닌 응답이면 기본 리포트", async () => {
    generateContent.mockResolvedValue({ text: "죄송해요, 분석할 수 없어요" });
    expect(await analyzeSubmission("a", "b")).toBe(FALLBACK_REPORT);
  });

  it("형식이 틀린 JSON(요약 2줄)이면 기본 리포트", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ ...GOOD, summary: ["a", "b"] }) });
    expect(await analyzeSubmission("a", "b")).toBe(FALLBACK_REPORT);
  });

  it("일반 오류는 재시도 없이 기본 리포트", async () => {
    generateContent.mockRejectedValue(new Error("boom"));
    expect(await analyzeSubmission("a", "b")).toBe(FALLBACK_REPORT);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("503이면 한 번만 재시도한다", async () => {
    vi.useFakeTimers();
    generateContent
      .mockRejectedValueOnce(Object.assign(new Error("overloaded"), { status: 503 }))
      .mockResolvedValueOnce({ text: JSON.stringify(GOOD) });
    const pending = analyzeSubmission("a", "b");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual(GOOD);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("재시도도 실패하면 기본 리포트", async () => {
    vi.useFakeTimers();
    generateContent.mockRejectedValue(Object.assign(new Error("limit"), { status: 429 }));
    const pending = analyzeSubmission("a", "b");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toBe(FALLBACK_REPORT);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});

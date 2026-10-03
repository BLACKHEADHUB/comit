import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/lib/clipboard";

afterEach(() => vi.unstubAllGlobals());

describe("copyText", () => {
  it("복사에 성공하면 true", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("https://example.com/invite/abc")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/invite/abc");
  });

  it("권한이 거부되면 예외 없이 false", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) } });
    await expect(copyText("x")).resolves.toBe(false);
  });

  it("클립보드를 지원하지 않는 환경이면 false", async () => {
    vi.stubGlobal("navigator", {});
    expect(await copyText("x")).toBe(false);
  });
});

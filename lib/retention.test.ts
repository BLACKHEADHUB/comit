import { describe, expect, it } from "vitest";
import { daysUntilExpiry, expiryCutoff, shouldWarnExpiry } from "@/lib/retention";

const now = new Date("2026-10-20T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe("daysUntilExpiry", () => {
  it("마지막 활동 후 남은 일 수를 센다", () => {
    expect(daysUntilExpiry(daysAgo(10), daysAgo(100), now, 90)).toBe(80);
    expect(daysUntilExpiry(daysAgo(90), daysAgo(100), now, 90)).toBe(0);
  });

  it("활동 기록이 없는 옛 프로젝트는 만든 시각을 기준으로 한다", () => {
    expect(daysUntilExpiry(undefined, daysAgo(60), now, 90)).toBe(30);
  });
});

describe("expiryCutoff / shouldWarnExpiry", () => {
  it("정리 기준 시각은 만료 일수만큼 이전이다", () => {
    expect(expiryCutoff(now, 90).getTime()).toBe(daysAgo(90).getTime());
  });

  it("만료 30일 전부터 안내한다", () => {
    expect(shouldWarnExpiry(31)).toBe(false);
    expect(shouldWarnExpiry(30)).toBe(true);
    expect(shouldWarnExpiry(0)).toBe(true);
  });
});

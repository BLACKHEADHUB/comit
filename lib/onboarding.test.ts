import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissOnboarding,
  hasReviewedOnce,
  isOnboardingDismissed,
  markReviewedOnce,
  onboardingSteps,
  subscribeOnboarding,
} from "@/lib/onboarding";

const none = { hasChanges: false, hasSubmitted: false, hasReviewed: false };

describe("onboardingSteps", () => {
  it("처음에는 아무것도 체크되지 않고 첫 단계가 '지금 할 일'", () => {
    const steps = onboardingSteps(none);
    expect(steps.map((s) => s.done)).toEqual([false, false, false]);
    expect(steps.map((s) => s.current)).toEqual([true, false, false]);
  });

  it("코드를 고치면 1단계 완료, 2단계가 지금 할 일", () => {
    const steps = onboardingSteps({ ...none, hasChanges: true });
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(steps.map((s) => s.current)).toEqual([false, true, false]);
  });

  it("Comit한 적이 있으면 (에디터가 원본과 같아도) 1·2단계 완료", () => {
    const steps = onboardingSteps({ ...none, hasSubmitted: true });
    expect(steps.map((s) => s.done)).toEqual([true, true, false]);
    expect(steps[2].current).toBe(true);
  });

  it("리뷰만 먼저 한 경우: 3단계만 체크되고 1단계가 지금 할 일", () => {
    const steps = onboardingSteps({ ...none, hasReviewed: true });
    expect(steps.map((s) => s.done)).toEqual([false, false, true]);
    expect(steps[0].current).toBe(true);
  });

  it("전부 끝나면 지금 할 일이 없다", () => {
    const steps = onboardingSteps({ hasChanges: true, hasSubmitted: true, hasReviewed: true });
    expect(steps.every((s) => s.done)).toBe(true);
    expect(steps.some((s) => s.current)).toBe(false);
  });
});

describe("온보딩 저장", () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    });
  });

  it("닫기 전에는 false, 닫으면 true로 기억한다", () => {
    expect(isOnboardingDismissed()).toBe(false);
    dismissOnboarding();
    expect(isOnboardingDismissed()).toBe(true);
    expect(hasReviewedOnce()).toBe(false); // 서로 다른 키
  });

  it("리뷰 완료 기록과 구독자 알림", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOnboarding(listener);
    markReviewedOnce();
    expect(hasReviewedOnce()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    dismissOnboarding();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("저장소를 못 쓰는 환경에서도 에러 없이 false", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(isOnboardingDismissed()).toBe(false);
    expect(() => dismissOnboarding()).not.toThrow();
  });
});

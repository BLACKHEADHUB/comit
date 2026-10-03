"use client";

import { useSyncExternalStore } from "react";
import Mascot from "@/components/Mascot";
import {
  dismissOnboarding,
  hasReviewedOnce,
  isOnboardingDismissed,
  onboardingSteps,
  subscribeOnboarding,
} from "@/lib/onboarding";

type Props = {
  hasChanges: boolean; // 에디터에서 원본과 다르게 고쳤는지
  hasSubmitted: boolean; // 내가 Comit한 제출이 있는지
};

// 처음 들어온 사람에게 보여주는 3단계 체크리스트. 직접 해보면 체크되고, 닫으면 다시 나오지 않는다
export default function OnboardingCard({ hasChanges, hasSubmitted }: Props) {
  // localStorage는 브라우저에만 있으므로, 서버 렌더에서는 "닫힘"으로 가정해 화면 불일치를 막는다
  const dismissed = useSyncExternalStore(subscribeOnboarding, isOnboardingDismissed, () => true);
  const hasReviewed = useSyncExternalStore(subscribeOnboarding, hasReviewedOnce, () => false);
  if (dismissed) return null;

  const steps = onboardingSteps({ hasChanges, hasSubmitted, hasReviewed });
  const allDone = steps.every((s) => s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section aria-label="시작 안내" className="m-3 mb-0 animate-fade-in rounded-2xl border border-line bg-background p-3 shadow-soft">
      <div className="flex items-start gap-2">
        {/* 코밋이: 처음엔 손을 흔들고, 세 가지를 다 하면 만세한다 */}
        <Mascot mood={allDone ? "cheer" : "hello"} size={40} className={allDone ? "comit-bounce-in" : ""} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">
            {allDone ? "잘했어요! 세 가지를 모두 해봤어요 🎉" : "처음이라면 이 세 가지만 해보세요"}
            {/* 좁은 화면에서는 단계를 접어 두므로 얼마나 했는지 숫자로 알려준다 */}
            {!allDone && <span className="ml-1.5 text-xs font-medium text-accent-ink sm:hidden">{doneCount}/3 완료</span>}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {allDone ? "이제 같은 순서로 팀원과 코드를 주고받으면 돼요. 이 안내는 닫아도 좋아요." : "직접 해보면 자동으로 체크돼요. 틀려도 괜찮아요!"}
          </p>
        </div>
        <button
          type="button"
          onClick={dismissOnboarding}
          aria-label="시작 안내 닫기 (다시 보지 않기)"
          className="-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-foreground"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>
      <ol className="mt-2.5 grid gap-2 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            aria-current={step.current ? "step" : undefined}
            // 좁은 화면에서는 "지금 할 단계"만 보여 에디터 자리를 지킨다 (넓은 화면에서는 세 단계 모두)
            className={`${step.current ? "flex" : "hidden sm:flex"} items-start gap-2 rounded-xl border p-2 text-xs ${
              step.current ? "border-accent bg-accent-soft" : "border-line bg-surface"
            }`}
          >
            {/* 체크 여부는 색 + 기호(✓ / 숫자) + 화면낭독기용 글자로 알려준다 */}
            <span
              aria-hidden
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                step.done ? "bg-ok-soft text-ok" : step.current ? "bg-accent text-white" : "bg-background text-muted ring-1 ring-line-strong"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block font-semibold ${step.done ? "text-muted line-through" : ""}`}>
                {step.title}
                <span className="sr-only">{step.done ? " (완료)" : step.current ? " (지금 할 일)" : ""}</span>
              </span>
              {!step.done && <span className="mt-0.5 block leading-relaxed text-muted">{step.hint}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

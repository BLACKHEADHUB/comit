// 첫 진입 온보딩(3단계 체크리스트)의 단계 판정과 브라우저 저장

export type OnboardingStep = { title: string; hint: string; done: boolean; current: boolean };

type Progress = {
  hasChanges: boolean; // 에디터에서 원본과 다르게 고쳤는지
  hasSubmitted: boolean; // 내가 Comit한 제출이 하나라도 있는지
  hasReviewed: boolean; // 댓글(리뷰)을 남긴 적이 있는지
};

// 실제 행동을 보고 체크 여부를 정한다. current는 아직 안 한 단계 중 첫 번째
export function onboardingSteps({ hasChanges, hasSubmitted, hasReviewed }: Progress): OnboardingStep[] {
  const steps = [
    // 이미 Comit한 사람은 코드도 고쳐본 것이다
    { title: "코드 고치기", hint: "에디터에서 아무 줄이나 고쳐보세요.", done: hasChanges || hasSubmitted },
    { title: "Comit하기", hint: "아래 [Comit하기]로 팀원에게 보여주세요.", done: hasSubmitted },
    { title: "리뷰 남기기", hint: "목록에서 제출을 열고 줄 옆의 + 를 눌러 댓글을 달아보세요.", done: hasReviewed },
  ];
  const firstTodo = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ ...s, current: i === firstTodo }));
}

type LeaderProgress = {
  hasReviewed: boolean; // 댓글(리뷰)을 남긴 적이 있는지
  hasMerged: boolean; // 이 프로젝트에 병합된 제출이 있는지 (병합은 팀장만 할 수 있다)
  hasTeam: boolean; // 나 말고 팀원이 한 명이라도 들어왔는지
};

// 팀장용 3단계: 팀장의 일은 "고치기"보다 "리뷰하고 병합하기"가 먼저다.
// 아직 혼자라면 리뷰할 것이 생길 수 없으므로 "초대하기"를 지금 할 일로 둔다
export function leaderOnboardingSteps({ hasReviewed, hasMerged, hasTeam }: LeaderProgress): OnboardingStep[] {
  const steps = [
    { title: "리뷰하기", hint: "'리뷰할 것' 목록에서 제출을 열고 줄 옆의 + 를 눌러 댓글을 달아보세요.", done: hasReviewed },
    { title: "병합하기", hint: "리뷰가 끝났으면 제출 화면의 [병합하기]로 원본에 반영해요.", done: hasMerged },
    { title: "초대하기", hint: "오른쪽 위 [초대 링크 복사]로 팀원을 불러요.", done: hasTeam },
  ];
  const current = hasTeam ? steps.findIndex((s) => !s.done) : 2;
  return steps.map((s, i) => ({ ...s, current: i === current }));
}

const DISMISSED_KEY = "comit_onboarding_dismissed";
const REVIEWED_KEY = "comit_onboarding_reviewed";

const listeners = new Set<() => void>();
export function subscribeOnboarding(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // 저장소를 못 쓰는 환경: 기억하지 못할 뿐 앱은 정상 동작
  }
}

function write(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {}
  listeners.forEach((cb) => cb()); // 같은 탭의 화면을 즉시 갱신
}

export const isOnboardingDismissed = () => read(DISMISSED_KEY);
export const dismissOnboarding = () => write(DISMISSED_KEY);
export const hasReviewedOnce = () => read(REVIEWED_KEY);
export const markReviewedOnce = () => write(REVIEWED_KEY);

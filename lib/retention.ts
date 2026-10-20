// 오래 안 쓴 프로젝트 정리 규칙 (순수 함수라 테스트하기 쉽다)
// 마지막 활동 후 EXPIRE_DAYS일이 지나면 정리 대상, 만료 WARN_DAYS일 전부터 화면에 안내한다
export const EXPIRE_DAYS = Number(process.env.PROJECT_EXPIRE_DAYS) || 90;
export const WARN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// 마지막 활동 시각(없으면 만든 시각)으로부터 정리까지 남은 일 수. 0 이하면 이미 만료
export function daysUntilExpiry(lastActivityAt: Date | undefined, createdAt: Date, now = new Date(), expireDays = EXPIRE_DAYS): number {
  const last = lastActivityAt ?? createdAt;
  return Math.ceil((last.getTime() + expireDays * DAY_MS - now.getTime()) / DAY_MS);
}

// 이 시각보다 오래 활동이 없으면 정리 대상
export const expiryCutoff = (now = new Date(), expireDays = EXPIRE_DAYS) => new Date(now.getTime() - expireDays * DAY_MS);

// 화면에 안내를 띄울 때인지 (만료 임박)
export const shouldWarnExpiry = (daysLeft: number) => daysLeft <= WARN_DAYS;

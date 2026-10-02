// 화면 전체에서 같은 모양을 쓰기 위한 공통 Tailwind 클래스 (색상은 app/globals.css의 토큰 사용)
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const btnPrimary = `${btnBase} bg-accent px-4 py-2 text-white shadow-sm hover:bg-accent-hover`;
export const btnSecondary = `${btnBase} border border-line-strong bg-background px-4 py-2 shadow-sm hover:bg-surface`;
export const btnGhost = `${btnBase} px-3 py-2 text-muted hover:bg-surface hover:text-foreground`;

export const inputClass =
  "w-full rounded-lg border border-line-strong bg-background px-3 py-2 text-sm shadow-sm transition placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export const card = "rounded-xl border border-line bg-background shadow-sm";

export const modalOverlay =
  "fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/50 p-4 backdrop-blur-sm";
export const modalCard = "w-full max-w-sm animate-pop-in rounded-2xl border border-line bg-background p-6 shadow-xl";

// 상태/태그 배지 (작은 알약 모양)
export const badge = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";

// 안내/오류 박스
export const noticeError = "rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger";
export const noticeWarn = "rounded-lg border border-warn/20 bg-warn-soft px-3 py-2 text-sm text-warn";
export const noticeOk = "rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-sm text-ok";

// "충돌(STALE)" 상태를 입문자가 이해하기 쉽게 풀어 쓴 설명 (탭/배지 툴팁에 사용)
export const STALE_LABEL = "다시 제출 필요";
export const STALE_HINT = "다른 변경이 먼저 병합돼서 최신 코드로 다시 제출해야 해요";

// 예상하지 못한 오류(네트워크 끊김 등)일 때 보여줄 공통 안내
export const RETRY_MESSAGE = "문제가 생겨 처리하지 못했어요. 인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.";

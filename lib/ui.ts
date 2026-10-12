// 화면 전체에서 같은 모양을 쓰기 위한 공통 Tailwind 클래스 (색상은 app/globals.css의 토큰 사용)
// 모양 원칙: 버튼은 알약형, 카드는 둥근 모서리 16px + 아주 부드러운 그림자 (DESIGN_NOTES.md "디자인 톤")
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition hover:-translate-y-px active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100";

export const btnPrimary = `${btnBase} bg-accent px-5 py-2 text-white shadow-soft hover:bg-accent-hover`;
export const btnSecondary = `${btnBase} border border-line-strong bg-background px-4 py-2 shadow-sm hover:bg-surface`;
export const btnGhost = `${btnBase} px-3 py-2 text-muted hover:bg-surface hover:text-foreground`;

export const inputClass =
  "w-full rounded-xl border border-line-strong bg-background px-3 py-2 text-sm shadow-sm transition placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export const card = "rounded-2xl border border-line bg-background shadow-soft";

export const modalOverlay =
  "fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/50 p-4 backdrop-blur-sm";
export const modalCard = "w-full max-w-sm animate-pop-in rounded-3xl border border-line bg-background p-6 shadow-xl";

// 상태/태그 배지 (작은 알약 모양)
export const badge = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";

// 안내/오류 박스
export const noticeError = "rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger";
export const noticeWarn = "rounded-xl border border-warn/20 bg-warn-soft px-3 py-2 text-sm text-warn";
export const noticeOk = "rounded-xl border border-ok/20 bg-ok-soft px-3 py-2 text-sm text-ok";

// "충돌(STALE)" 상태를 입문자가 이해하기 쉽게 풀어 쓴 설명 (탭/배지 툴팁에 사용)
export const STALE_LABEL = "다시 제출 필요";
export const STALE_HINT = "다른 변경이 먼저 병합돼서, 내 수정은 그대로 두고 최신 원본 위에 다시 얹어 Comit해야 해요";

// 예상하지 못한 오류(네트워크 끊김 등)일 때 보여줄 공통 안내
export const RETRY_MESSAGE = "문제가 생겨 처리하지 못했어요. 인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.";

// 제출 상태를 화면에 보여줄 때 쓰는 라벨/아이콘/색 (색만으로 구분하지 않도록 아이콘과 글자를 함께 쓴다)
export const STATUS_META = {
  PENDING: { label: "대기", icon: "⏳", style: "bg-surface text-muted ring-1 ring-line-strong" },
  MERGED: { label: "병합됨", icon: "✓", style: "bg-ok-soft text-ok" },
  STALE: { label: STALE_LABEL, icon: "↻", style: "bg-warn-soft text-warn" },
} as const;

// 서버 액션이 돌려주는 오류 문구 (탓하지 않는 말투: 무슨 일이 있었는지 + 어떻게 하면 되는지)
export const BAD_REQUEST_MESSAGE = "요청을 제대로 받지 못했어요. 페이지를 새로고침한 뒤 다시 시도해주세요.";
export const SUBMISSION_GONE_MESSAGE = "이 제출을 찾지 못했어요. 목록으로 돌아가 다시 열어주세요.";
export const COMMENT_GONE_MESSAGE = "이 댓글을 찾지 못했어요. 화면을 새로고침한 뒤 다시 시도해주세요.";
export const NOT_MEMBER_MESSAGE = "이 프로젝트의 멤버만 할 수 있어요. 초대 링크로 다시 들어와 주세요.";

// 화면 전체에서 같은 모양을 쓰기 위한 공통 Tailwind 클래스
export const btnPrimary =
  "rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
export const btnSecondary =
  "rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
export const btnGhost = "px-3 py-2 text-sm text-zinc-600 hover:underline dark:text-zinc-400";
export const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
export const modalOverlay = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6";
export const modalCard = "w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900";

// 예상하지 못한 오류(네트워크 끊김 등)일 때 보여줄 공통 안내
export const RETRY_MESSAGE = "문제가 생겨 처리하지 못했어요. 인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.";

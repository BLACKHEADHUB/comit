import type { CommentTag } from "@/lib/validation";

// 댓글 태그의 화면 표시 (DB에는 LIKE/QUESTION/BUG가 그대로 저장되고, 화면에는 한국어 라벨을 쓴다)
export const TAGS: { tag: CommentTag; emoji: string; label: string }[] = [
  { tag: "LIKE", emoji: "👍", label: "좋아요" },
  { tag: "QUESTION", emoji: "❓", label: "질문" },
  { tag: "BUG", emoji: "🐞", label: "버그" },
];

// 태그별 배지 색상 (LIKE=초록, QUESTION=포인트, BUG=빨강)
export const TAG_STYLE: Record<CommentTag, string> = {
  LIKE: "bg-ok-soft text-ok",
  QUESTION: "bg-accent-soft text-accent",
  BUG: "bg-danger-soft text-danger",
};

export const tagMeta = (tag: CommentTag) => TAGS.find((t) => t.tag === tag)!;

// 서버/브라우저 시간대가 달라도 같은 결과가 나오도록 시간대를 고정한다 (hydration 불일치 방지)
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

import type { CommentTag } from "@/lib/validation";

// 리뷰 코칭: 댓글이 비었거나 너무 짧으면 "어떻게 쓰면 도움이 되는지"와 바로 쓸 수 있는 첫마디를 보여준다.
// AI를 부르지 않는 고정 문구라 비용이 들지 않고 바로 뜬다
export const COACH_MIN_CHARS = 15;

const COACH: Record<CommentTag, { tip: string; starters: string[] }> = {
  LIKE: {
    tip: "어디가 왜 좋았는지 한 줄 더 남기면 팀원이 배워요.",
    starters: ["변수 이름이 읽기 쉬워요. ", "함수로 나누니 흐름이 잘 보여요. ", "이 부분 덕분에 중복이 줄었어요. "],
  },
  QUESTION: {
    tip: "무엇이 궁금한지 구체적으로 물으면 답하기 쉬워요.",
    starters: ["이 줄은 어떤 경우를 위해 넣은 거예요? ", "왜 이 방법을 골랐는지 궁금해요. ", "값이 비어 있으면 어떻게 돼요? "],
  },
  BUG: {
    tip: "어떤 입력에서 무엇이 잘못되는지 적으면 고치기 쉬워요.",
    starters: ["이 입력이면 오류가 날 것 같아요: ", "예상한 결과는 ○○인데 실제로는 ", "이렇게 고치면 어때요? "],
  },
};

// 내용이 충분하면 null (코칭을 숨긴다)
export function coachFor(tag: CommentTag, content: string): { tip: string; starters: string[] } | null {
  return content.trim().length >= COACH_MIN_CHARS ? null : COACH[tag];
}

// 첫마디를 눌렀을 때: 비어 있으면 그대로, 이미 쓴 글이 있으면 앞에 붙인다 (쓴 글을 지우지 않는다)
export function applyStarter(content: string, starter: string, maxLength = 300): string {
  const next = content.trim() ? `${starter}${content.trim()}` : starter;
  return next.slice(0, maxLength);
}

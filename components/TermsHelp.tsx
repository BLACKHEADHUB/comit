// 화면에 나오는 낯선 말을 한곳에서 풀어 주는 작은 용어 사전.
// <details>라 JS 없이 열리고 키보드(Enter/Space)로도 동작한다 (MemberAvatars와 같은 방식)
const TERMS = [
  { term: "원본", desc: "팀 모두가 함께 쓰는 기준 코드예요. 팀장이 병합할 때만 바뀌어요." },
  { term: "Comit하기", desc: "내가 고친 코드를 팀원에게 \"이렇게 바꾸면 어때요?\" 하고 보내는 거예요. 보내도 원본은 아직 그대로예요." },
  { term: "리뷰", desc: "바뀐 줄에 👍 좋아요 / ❓ 질문 / 🐞 버그 댓글을 남기는 거예요. 칭찬 한마디도 좋은 리뷰예요." },
  { term: "병합", desc: "팀장이 Comit된 코드를 원본에 반영하는 거예요. 병합되면 그 코드가 새 원본이 돼요." },
  { term: "다시 제출 필요", desc: "내 Comit보다 다른 변경이 먼저 병합된 상태예요. 최신 원본을 바탕으로 다시 Comit하면 돼요." },
];

export default function TermsHelp({ align = "right" }: { align?: "left" | "right" }) {
  return (
    <details className="relative">
      <summary
        aria-label="용어 설명 보기"
        className="flex cursor-pointer list-none items-center gap-1 rounded-full px-2 py-1 text-xs text-muted transition hover:bg-surface hover:text-foreground [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden className="flex size-4 items-center justify-center rounded-full ring-1 ring-line-strong text-[10px] font-semibold">
          ?
        </span>
        용어 설명
      </summary>
      <dl
        className={`absolute ${align === "right" ? "right-0" : "left-0"} z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] space-y-2.5 rounded-2xl border border-line bg-background p-3.5 text-left text-xs text-foreground shadow-xl`}
      >
        {TERMS.map((t) => (
          <div key={t.term}>
            <dt className="font-semibold">{t.term}</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">{t.desc}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

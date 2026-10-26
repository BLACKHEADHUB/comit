import Link from "next/link";
import EnterForm from "@/components/EnterForm";
import LandingModal from "@/components/LandingModal";
import Mascot from "@/components/Mascot";
import SiteFooter from "@/components/SiteFooter";
import { card } from "@/lib/ui";

// 4단계 소개 카드. tone은 아이콘 칩의 파스텔 배경 + 글자 색 (파스텔 위에는 회색 글자를 쓰지 않는다)
const STEPS = [
  {
    icon: "✍️",
    title: "코드 고치기",
    desc: "설치 없이 웹 에디터에서 바로 고쳐요. 원본은 그대로라 마음껏 해봐도 돼요.",
    tone: "bg-mint-soft text-mint",
  },
  {
    icon: "📤",
    title: "Comit하기",
    desc: "버튼 한 번이면 내가 바꾼 부분이 팀원에게 전해져요.",
    tone: "bg-lavender-soft text-lavender",
  },
  {
    icon: "🤖",
    title: "AI가 요약",
    desc: "무엇이 바뀌었는지 3줄로, 조심할 점과 배울 개념까지 쉽게 알려줘요.",
    tone: "bg-peach-soft text-peach",
  },
  {
    icon: "✅",
    title: "리뷰하고 합치기",
    desc: "줄마다 댓글로 이야기 나누고, 팀장이 안전하게 합쳐요.",
    tone: "bg-accent-soft text-accent-ink",
  },
];

export default function Home() {
  return (
    // 바깥 상자: 화면 전체 폭. 배경 장식이 본문 폭에서 뚝 끊기지 않게 하고, 넘치는 부분은 잘라 가로 스크롤을 막는다
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* 배경 장식: 아주 옅은 파스텔 번짐 (정보를 가리지 않게 글자 뒤에 둔다) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem]"
      >
        <div className="absolute left-[12%] top-16 size-72 rounded-full bg-lavender-soft opacity-70 blur-3xl" />
        <div className="absolute right-[12%] top-36 size-72 rounded-full bg-mint-soft opacity-70 blur-3xl" />
        <div className="absolute left-[40%] top-72 size-56 rounded-full bg-peach-soft opacity-60 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-5">
        <header className="flex items-center justify-between py-5">
          <span className="text-lg font-bold tracking-tight">
            Comit<span className="text-accent-ink">.</span>
          </span>
          <span className="text-xs text-muted">
            코딩 입문자를 위한 협업 샌드박스
          </span>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center gap-5 py-12 text-center sm:py-20">
          <Mascot mood="hello" size={104} />
          <span className="rounded-full border border-line bg-background px-3 py-1 text-xs text-muted shadow-soft">
            터미널도 Git도 몰라도 괜찮아요
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            처음 하는 코드 협업,
            <br />
            <span className="text-accent-ink">웹에서 바로</span> 해봐요
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted">
            코드를 고치고, AI의 설명을 듣고, 팀원과 이야기 나누고, 안전하게
            합치는 것까지. 브라우저 하나면 충분해요.
          </p>
          <div className="mt-1 flex flex-col items-center gap-3">
            <LandingModal />
            <EnterForm />
            {/* 강사·조교용: 여러 팀의 기여도를 한 화면에서 보는 수업 만들기 */}
            <Link href="/class/create" className="text-xs text-muted underline-offset-2 transition hover:text-foreground hover:underline">
              강사·조교이신가요? 수업 만들기 →
            </Link>
          </div>
        </section>

        <section
          aria-label="이렇게 진행돼요"
          className="grid gap-3 pb-16 sm:grid-cols-2 lg:grid-cols-4"
        >
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`${card} p-4 transition hover:-translate-y-1`}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={`flex size-10 items-center justify-center rounded-2xl text-xl ${s.tone}`}
                >
                  {s.icon}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}
                >
                  STEP {i + 1}
                </span>
              </div>
              <h2 className="text-sm font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {s.desc}
              </p>
            </div>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

import LandingModal from "@/components/LandingModal";
import { card } from "@/lib/ui";

const STEPS = [
  { icon: "✍️", title: "코드 작성", desc: "설치 없이 웹 에디터에서 바로 코드를 고쳐요." },
  { icon: "📤", title: "Comit하기", desc: "버튼 한 번으로 변경 내용을 팀에 제출해요." },
  { icon: "🤖", title: "AI가 요약", desc: "3줄 요약, 위험 경고, 핵심 개념을 쉽게 알려줘요." },
  { icon: "✅", title: "리뷰 후 병합", desc: "줄마다 댓글을 달고, 팀장이 안전하게 합쳐요." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <span className="text-lg font-bold tracking-tight">
          Comit<span className="text-accent">.</span>
        </span>
        <span className="text-xs text-muted">코딩 입문자를 위한 협업 샌드박스</span>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center sm:py-24">
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
          터미널도 Git도 필요 없어요
        </span>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          팀 코드 협업,
          <br />
          <span className="text-accent">웹에서 바로</span> 시작하세요
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted">
          코드를 쓰고, AI의 설명을 받고, 팀원과 리뷰하고, 안전하게 합치는 과정을 브라우저 하나로 끝내요.
        </p>
        <div className="flex flex-col items-center gap-3">
          <LandingModal />
          <p className="text-xs text-muted">초대 링크를 받았다면, 링크를 열어 닉네임만 입력하면 바로 참여할 수 있어요.</p>
        </div>
      </section>

      <section className="grid gap-3 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className={`${card} p-4 transition hover:-translate-y-0.5 hover:shadow-md`}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">{s.icon}</span>
              <span className="text-xs font-medium text-muted">STEP {i + 1}</span>
            </div>
            <h2 className="text-sm font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

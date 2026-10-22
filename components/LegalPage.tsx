import Link from "next/link";
import { LEGAL_UPDATED } from "@/lib/contact";

// 약관·개인정보 처리방침 화면의 공통 틀 (읽기 쉬운 폭 + 큰 제목 + 목차 없는 단순 문서)
export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/" className="w-fit text-lg font-bold tracking-tight transition hover:opacity-70">
        Comit<span className="text-accent-ink">.</span>
      </Link>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-xs text-muted">마지막 수정: {LEGAL_UPDATED}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{intro}</p>
      </header>
      <div className="flex flex-col gap-6 text-sm leading-relaxed [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:mt-1 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </main>
  );
}

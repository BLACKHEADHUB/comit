import Link from "next/link";
import Mascot, { type MascotMood } from "@/components/Mascot";
import { card } from "@/lib/ui";

// 생성/초대/404처럼 가운데에 카드 하나를 보여주는 화면의 공통 틀
export default function CenteredCard({
  title,
  description,
  mood = "hello",
  children,
}: {
  title: string;
  description?: string;
  mood?: MascotMood; // 카드 위에 앉아 있는 코밋이의 표정
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-16 px-4 py-10">
      <Link href="/" className="text-lg font-bold tracking-tight transition hover:opacity-70">
        Comit<span className="text-accent-ink">.</span>
      </Link>
      <div className={`${card} relative w-full max-w-md p-6 pt-9 sm:p-8 sm:pt-10`}>
        {/* 카드 위에 살짝 걸터앉은 마스코트 (장식) */}
        <Mascot mood={mood} size={84} className="absolute -top-14 left-1/2 -translate-x-1/2" />
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

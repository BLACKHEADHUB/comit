import Link from "next/link";
import { card } from "@/lib/ui";

// 생성/초대/404처럼 가운데에 카드 하나를 보여주는 화면의 공통 틀
export default function CenteredCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-lg font-bold tracking-tight transition hover:opacity-70">
        Comit<span className="text-accent">.</span>
      </Link>
      <div className={`${card} w-full max-w-md p-6 sm:p-8`}>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

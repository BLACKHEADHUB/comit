import Link from "next/link";
import { operatorInfo } from "@/lib/contact";

// 첫 화면 아래의 바닥글: 약관, 개인정보 처리방침, 문의·신고 메일
export default function SiteFooter() {
  const { name, email } = operatorInfo();
  return (
    <footer className="relative border-t border-line px-5 py-6 text-xs text-muted">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2">
        <span>© {new Date().getFullYear()} {name}</span>
        <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">이용약관</Link>
        <Link href="/privacy" className="font-semibold underline-offset-2 hover:text-foreground hover:underline">개인정보 처리방침</Link>
        {email && (
          <a href={`mailto:${email}`} className="underline-offset-2 hover:text-foreground hover:underline">
            문의·신고
          </a>
        )}
      </div>
    </footer>
  );
}

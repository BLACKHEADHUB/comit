import Link from "next/link";
import { btnPrimary } from "@/lib/ui";

// 존재하지 않는 페이지이거나 멤버가 아닐 때(권한 없음) 같은 화면을 보여준다
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없어요</h1>
      <p className="text-sm text-zinc-500">
        주소가 잘못됐거나, 이 프로젝트의 멤버가 아니에요. 팀장에게 받은 초대 링크로 다시 들어와 보세요.
      </p>
      <Link href="/" className={btnPrimary}>
        처음으로
      </Link>
    </main>
  );
}

import Link from "next/link";
import CenteredCard from "@/components/CenteredCard";
import { btnPrimary } from "@/lib/ui";

// 존재하지 않는 페이지이거나 멤버가 아닐 때(권한 없음) 같은 화면을 보여준다
export default function NotFound() {
  return (
    <CenteredCard
      mood="oops"
      title="앗, 여기엔 아무것도 없어요"
      description="주소가 조금 다르거나, 아직 이 프로젝트의 멤버가 아닐 수 있어요. 팀장에게 받은 초대 링크로 다시 들어와 보세요."
    >
      <Link href="/" className={`${btnPrimary} w-full`}>
        처음으로
      </Link>
    </CenteredCard>
  );
}

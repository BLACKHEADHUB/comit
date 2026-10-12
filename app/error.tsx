"use client";

import CenteredCard from "@/components/CenteredCard";
import { btnPrimary } from "@/lib/ui";

// 예상 못 한 오류가 나도 하얀 화면 대신 안내와 다시 시도 버튼을 보여준다
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <CenteredCard
      mood="oops"
      title="앗, 문제가 생겼어요"
      description="잠깐 불러오지 못했어요. 작성하던 코드는 이 브라우저에 임시 저장돼 있으니 걱정하지 말고 다시 시도해 보세요."
    >
      <button type="button" onClick={reset} className={`${btnPrimary} w-full`}>
        다시 시도
      </button>
    </CenteredCard>
  );
}

"use client";

import { useState } from "react";
import { copyText, showForManualCopy } from "@/lib/clipboard";
import { btnSecondary, noticeWarn } from "@/lib/ui";

// 복구 코드를 한 번 보여주는 카드 (만들 때/합류할 때/새로 받을 때 같이 쓴다)
export default function RecoveryCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <p className={noticeWarn}>🔑 내 복구 코드예요. 지금만 보여주니 꼭 저장해두세요. 브라우저 기록이 지워져도 이 코드로 돌아올 수 있어요.</p>
      <code className="block rounded-lg border border-line bg-surface p-3 text-center font-mono text-base font-semibold tracking-wider">
        {code}
      </code>
      <button
        type="button"
        className={btnSecondary}
        onClick={async () => {
          if (await copyText(code)) setCopied(true);
          else showForManualCopy(code);
        }}
      >
        {copied ? "✓ 복사됨" : "코드 복사"}
      </button>
      <p className="text-xs text-muted">홈 화면 입력칸에 넣으면 돼요. 잃어버려도 프로젝트 오른쪽 위 멤버 메뉴에서 새로 받을 수 있어요.</p>
    </div>
  );
}

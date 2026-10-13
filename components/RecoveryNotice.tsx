"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dismissRecoveryNotice } from "@/app/actions/member";
import { copyText, showForManualCopy } from "@/lib/clipboard";
import { btnGhost, btnSecondary } from "@/lib/ui";

// 합류 직후 프로젝트 화면 맨 위에 한 번 뜨는 복구 코드 안내
export default function RecoveryNotice({ projectId, code }: { projectId: string; code: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-warn/20 bg-warn-soft px-4 py-2 text-sm text-warn">
      <span className="font-medium">🔑 내 복구 코드</span>
      <code className="rounded-lg border border-line bg-background px-2 py-1 font-mono text-sm font-semibold tracking-wider text-foreground">{code}</code>
      <span className="text-xs">지금만 보여요. 브라우저 기록이 지워져도 이 코드를 홈 화면에 넣으면 돌아올 수 있어요.</span>
      <span className="ml-auto flex gap-2">
        <button
          type="button"
          className={`${btnSecondary} !px-3 !py-1 !text-xs`}
          onClick={async () => {
            if (await copyText(code)) setCopied(true);
            else showForManualCopy(code);
          }}
        >
          {copied ? "✓ 복사됨" : "코드 복사"}
        </button>
        <button
          type="button"
          className={`${btnGhost} !px-3 !py-1 !text-xs`}
          onClick={async () => {
            await dismissRecoveryNotice(projectId);
            router.refresh(); // 쿠키가 지워진 상태로 다시 그려 안내를 닫는다
          }}
        >
          저장했어요
        </button>
      </span>
    </div>
  );
}

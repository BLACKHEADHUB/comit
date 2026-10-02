"use client";

import { useState } from "react";
import { btnSecondary } from "@/lib/ui";

// 팀장 전용: 초대 링크를 한 번에 복사하는 버튼
export default function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={url}
      className={`${btnSecondary} !px-3 !py-1.5 !text-xs`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("아래 링크를 복사해 팀원에게 공유하세요.", url); // 클립보드 권한이 없을 때의 대체 수단
        }
      }}
    >
      {copied ? "✓ 복사됨" : "🔗 초대 링크 복사"}
    </button>
  );
}

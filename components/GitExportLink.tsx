"use client";

import { useSyncExternalStore } from "react";
import { readLanguage, subscribeLanguage } from "@/lib/draft";

// 병합 기록을 Git 저장소(zip)로 내려받는 링크. 에디터에서 고른 언어로 파일 확장자를 정한다
export default function GitExportLink({ projectId }: { projectId: string }) {
  const language = useSyncExternalStore(subscribeLanguage, () => readLanguage(projectId), () => "plaintext");
  return (
    <a
      href={`/api/project/${projectId}/export-git?lang=${language}`}
      download
      title="병합된 기록이 커밋으로 들어 있는 Git 저장소예요. GitHub에 그대로 올릴 수 있어요."
      className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
    >
      ⬇ Git 기록으로 내려받기 (GitHub용)
    </a>
  );
}

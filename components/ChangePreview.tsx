"use client";

import dynamic from "next/dynamic";
import { summarizeChanges } from "@/lib/changes";
import { useIsDark } from "@/lib/useIsDark";
import { badge } from "@/lib/ui";

// Diff Viewer는 브라우저 전용이라 SSR을 끄고 불러온다
const DiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => <p className="p-3 text-xs text-muted">변경 내용 불러오는 중...</p>,
});

type Props = {
  before: string;
  after: string;
  label?: string; // 요약 문구의 앞부분 (기본: "원본에서")
  emptyText?: string; // 달라진 곳이 없을 때 보여줄 문구
};

// 두 코드가 "무엇이 달라졌는지"를 보여주는 미니 Diff (Comit 전 확인, 최신 원본 보기에서 함께 쓴다)
export default function ChangePreview({
  before,
  after,
  label = "원본에서",
  emptyText = "원본과 달라진 곳이 없어요. 에디터에서 코드를 고친 뒤 다시 눌러주세요.",
}: Props) {
  const dark = useIsDark();
  const { added, removed, changed } = summarizeChanges(before, after);

  if (changed === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong p-4 text-center text-sm leading-relaxed text-muted">{emptyText}</p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{label} {changed}줄 바뀜</span>
        {/* 색만으로 구분하지 않도록 기호(+/−)와 글자를 함께 쓴다 */}
        <span className={`${badge} bg-ok-soft text-ok`}>+{added} 추가</span>
        <span className={`${badge} bg-danger-soft text-danger`}>−{removed} 삭제</span>
      </div>
      {/* 긴 줄은 이 상자 안에서만 가로 스크롤 (페이지 전체가 밀리지 않게) */}
      <div
        tabIndex={0}
        role="region"
        aria-label="원본과 달라진 부분 미리보기"
        className="max-h-80 overflow-auto rounded-lg border border-line text-xs"
      >
        <DiffViewer
          oldValue={before}
          newValue={after}
          splitView={false}
          showDiffOnly
          extraLinesSurroundingDiff={1}
          hideSummary
          useDarkTheme={dark}
          // 코드 글자는 에디터와 같은 16px로 (작으면 무엇이 바뀌었는지 읽기 어렵다)
          styles={{ contentText: { fontSize: "16px", lineHeight: "26px" }, lineNumber: { fontSize: "14px" } }}
          codeFoldMessageRenderer={(total) => <span className="text-xs">변경 없는 {total}줄 펼치기</span>}
        />
      </div>
    </div>
  );
}

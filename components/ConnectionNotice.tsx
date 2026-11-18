"use client";

import { btnSecondary, noticeWarn } from "@/lib/ui";

// 자동 갱신이 이 횟수만큼 연속으로 실패하면 안내한다 (한 번쯤은 네트워크가 잠깐 끊긴 것일 수 있어서 조용히 넘긴다)
export const FAIL_NOTICE_AT = 2;

// "새 소식을 못 받아오는 중"을 알리는 작은 띠. 작성 중인 코드는 이 브라우저 탭에 임시 저장돼 있어서 새로고침해도 남는다
export default function ConnectionNotice({ failures, className = "" }: { failures: number; className?: string }) {
  if (failures < FAIL_NOTICE_AT) return null;
  return (
    <div role="status" className={`${noticeWarn} flex flex-wrap items-center gap-2 !py-1.5 !text-xs ${className}`}>
      <span className="min-w-0 flex-1 basis-56 leading-relaxed">
        <strong className="font-semibold">연결이 불안정해요.</strong> 새 댓글이나 병합 소식이 늦게 보일 수 있어요. 연결이 돌아오면 자동으로 다시 불러와요.
      </span>
      <button type="button" onClick={() => window.location.reload()} className={`${btnSecondary} !px-2.5 !py-1 !text-xs`}>
        새로고침
      </button>
    </div>
  );
}

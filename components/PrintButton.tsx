"use client";

import { btnSecondary } from "@/lib/ui";

// 브라우저 인쇄 창을 연다. 인쇄 창에서 "PDF로 저장"을 고르면 과제 제출용 파일이 된다
export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${btnSecondary} print:hidden`}>
      🖨️ 인쇄 / PDF로 저장
    </button>
  );
}

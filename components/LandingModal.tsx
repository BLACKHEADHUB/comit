"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Mascot from "@/components/Mascot";
import { btnGhost, btnPrimary, modalCard, modalOverlay } from "@/lib/ui";

// "프로젝트 생성" 버튼을 누르면 뜨는 안내 모달
export default function LandingModal() {
  const [open, setOpen] = useState(false);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btnPrimary} !px-6 !py-3 !text-base`}
      >
        프로젝트 만들기
      </button>
      {open && (
        <div
          className={modalOverlay}
          onClick={() => setOpen(false)} // 바깥 클릭 시 닫기
        >
          <div
            role="dialog"
            aria-modal="true"
            className={`${modalCard} text-left`} // 가운데 정렬된 화면 안에 있어도 창 안의 글은 왼쪽 정렬
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Mascot mood="happy" size={48} />
              <h2 className="text-lg font-semibold tracking-tight">새 프로젝트를 시작해볼까요?</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              닉네임만 정하면 바로 만들어져요. 회원가입도 설치도 없어요. 만든 뒤에는 초대 링크를 팀원에게 보내주세요.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
                취소
              </button>
              <Link
                href="/project/create"
                className={btnPrimary}
              >
                시작하기
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

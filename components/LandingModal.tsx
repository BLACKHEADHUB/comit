"use client";

import Link from "next/link";
import { useState } from "react";

// "프로젝트 생성" 버튼을 누르면 뜨는 안내 모달
export default function LandingModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        프로젝트 생성
      </button>
      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setOpen(false)} // 바깥 클릭 시 닫기
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl bg-white p-6 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">새 프로젝트를 시작할까요?</h2>
            <p className="mt-2 text-sm text-zinc-500">
              닉네임만 정하면 바로 만들 수 있어요. 만든 뒤 초대 링크를 팀원에게 공유하세요.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm">
                취소
              </button>
              <Link
                href="/project/create"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
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

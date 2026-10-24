"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createClassroom } from "@/app/actions/classroom";
import { copyText, showForManualCopy } from "@/lib/clipboard";
import { btnPrimary, btnSecondary, inputClass, noticeError, noticeOk, noticeWarn } from "@/lib/ui";

export default function CreateClassForm() {
  const [state, formAction, pending] = useActionState(createClassroom, {});
  const [copied, setCopied] = useState("");

  const copy = async (what: string, text: string) => {
    if (await copyText(text)) setCopied(what);
    else showForManualCopy(text);
  };

  // 만들기 성공: 반 코드(학생용)와 강사용 비밀 링크를 한 번 보여준다
  if (state.ownerUrl && state.joinCode) {
    const ownerUrl = state.ownerUrl;
    const joinCode = state.joinCode;
    return (
      <div className="flex flex-col gap-4">
        <div className={noticeOk}>🎉 수업이 만들어졌어요!</div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">반 코드 (학생들에게 알려주세요)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-line bg-surface p-3 text-center font-mono text-lg font-semibold tracking-widest">{joinCode}</code>
            <button type="button" className={btnSecondary} onClick={() => copy("code", joinCode)}>
              {copied === "code" ? "✓ 복사됨" : "복사"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">각 팀의 팀장이 프로젝트의 [📊 기여도] 화면 아래에 이 코드를 넣으면 연결돼요.</p>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">강사용 링크 (나만 보관하세요)</p>
          <code data-testid="owner-url" className="block break-all rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed">{ownerUrl}</code>
          <button type="button" className={`${btnSecondary} mt-2 w-full`} onClick={() => copy("url", ownerUrl)}>
            {copied === "url" ? "✓ 복사됨" : "링크 복사"}
          </button>
        </div>
        <p className={noticeWarn}>이 링크가 강사님의 열쇠예요. 다시 보여드릴 수 없으니 북마크하거나 메모해두세요. 다른 사람에게 보내면 그 사람도 수업 화면을 볼 수 있어요.</p>
        <Link href={new URL(ownerUrl).pathname} className={btnPrimary}>
          수업 화면으로 이동 →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        수업 이름
        <input name="title" required maxLength={50} placeholder="예) 2026-2 웹프로그래밍 01분반" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span>
          강사 이름 <span className="font-normal text-muted">(선택, 학생에게 보여요)</span>
        </span>
        <input name="instructorName" maxLength={20} placeholder="예) 김교수" className={inputClass} />
      </label>
      {state.error && <p role="alert" className={noticeError}>{state.error}</p>}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "만드는 중..." : "수업 만들기"}
      </button>
    </form>
  );
}

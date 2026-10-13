"use client";

import { useActionState } from "react";
import { enterWithCode } from "@/app/actions/enter";
import { btnSecondary, inputClass, noticeError } from "@/lib/ui";

// 홈 화면의 작은 입력칸: 초대 링크/코드로 참여하거나, 복구 코드로 내 자리로 돌아온다
export default function EnterForm() {
  const [state, formAction, pending] = useActionState(enterWithCode, {});

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="code"
          required
          maxLength={300}
          autoComplete="off"
          aria-label="초대 링크 또는 복구 코드"
          placeholder="초대 링크 · 초대 코드 · 복구 코드"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button type="submit" disabled={pending} className={`${btnSecondary} shrink-0`}>
          {pending ? "확인 중..." : "들어가기"}
        </button>
      </div>
      {state.error && <p role="alert" className={noticeError}>{state.error}</p>}
      <p className="text-xs text-muted">팀원에게 받은 링크나 코드를 붙여넣거나, 저장해둔 복구 코드로 내 프로젝트에 돌아와요.</p>
    </form>
  );
}

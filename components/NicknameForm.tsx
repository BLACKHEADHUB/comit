"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { btnPrimary, inputClass, noticeError } from "@/lib/ui";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  token?: string; // 초대 합류 시 hidden으로 전달
};

export default function NicknameForm({ action, submitLabel, token }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {token && <input type="hidden" name="token" value={token} />}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        내 닉네임
        <input name="nickname" required maxLength={20} placeholder="예) 코밋" aria-describedby="nickname-hint" className={inputClass} />
        {/* 회원가입이 없다는 걸 먼저 알려 망설이지 않게 한다 */}
        <span id="nickname-hint" className="text-xs font-normal text-muted">
          팀원에게 보이는 이름이에요. 회원가입은 필요 없어요.
        </span>
      </label>
      {state.error && <p role="alert" className={noticeError}>{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={btnPrimary}
      >
        {pending ? "처리 중..." : submitLabel}
      </button>
      {/* 만들기/합류 = 약관 동의 (작게, 링크는 새 탭으로 열어 입력한 내용을 잃지 않게) */}
      <p className="-mt-2 text-center text-xs text-muted">
        계속하면 <a href="/terms" target="_blank" className="underline">이용약관</a>과{" "}
        <a href="/privacy" target="_blank" className="underline">개인정보 처리방침</a>에 동의하는 거예요.
      </p>
    </form>
  );
}

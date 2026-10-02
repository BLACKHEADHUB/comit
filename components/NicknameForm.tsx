"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { btnPrimary, inputClass } from "@/lib/ui";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  token?: string; // 초대 합류 시 hidden으로 전달
};

export default function NicknameForm({ action, submitLabel, token }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {token && <input type="hidden" name="token" value={token} />}
      <label className="flex flex-col gap-1 text-sm">
        내 닉네임
        <input name="nickname" required maxLength={20} className={inputClass} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={btnPrimary}
      >
        {pending ? "처리 중..." : submitLabel}
      </button>
    </form>
  );
}

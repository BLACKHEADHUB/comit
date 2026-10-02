"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  token?: string; // 초대 합류 시 hidden으로 전달
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

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
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "처리 중..." : submitLabel}
      </button>
    </form>
  );
}

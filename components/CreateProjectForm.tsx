"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createProject } from "@/app/actions/project";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

export default function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, {});
  const [copied, setCopied] = useState(false);

  // 생성 성공: 초대 링크를 보여주고, 사용자가 확인한 뒤 프로젝트로 이동한다
  if (state.projectId && state.inviteUrl) {
    const inviteUrl = state.inviteUrl;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">프로젝트가 만들어졌어요! 팀원에게 이 링크를 공유하세요.</p>
        <code className="break-all rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700">
          {inviteUrl}
        </code>
        <button
          type="button"
          className={btnSecondary}
          onClick={async () => {
            await navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
          }}
        >
          {copied ? "복사됨!" : "링크 복사"}
        </button>
        <Link href={`/project/${state.projectId}`} className={btnPrimary}>
          프로젝트로 이동
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        내 닉네임
        <input name="nickname" required maxLength={20} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        프로젝트 이름 (선택)
        <input name="title" maxLength={50} className={inputClass} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "만드는 중..." : "프로젝트 만들기"}
      </button>
    </form>
  );
}

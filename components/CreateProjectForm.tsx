"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createProject } from "@/app/actions/project";
import { STARTER_TEMPLATES, DEFAULT_TEMPLATE_ID } from "@/lib/templates";
import { copyText, showForManualCopy } from "@/lib/clipboard";
import { btnPrimary, btnSecondary, inputClass, noticeError, noticeOk } from "@/lib/ui";

export default function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, {});
  const [copied, setCopied] = useState(false);

  // 생성 성공: 초대 링크를 보여주고, 사용자가 확인한 뒤 프로젝트로 이동한다
  if (state.projectId && state.inviteUrl) {
    const inviteUrl = state.inviteUrl;
    return (
      <div className="flex flex-col gap-4">
        <div className={noticeOk}>🎉 프로젝트가 만들어졌어요! 아래 초대 링크를 단톡방 등에 보내면, 팀원이 닉네임만 정하고 바로 들어올 수 있어요.</div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">초대 링크</p>
          <code className="block break-all rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed">
            {inviteUrl}
          </code>
        </div>
        <button
          type="button"
          className={btnSecondary}
          onClick={async () => {
            // 클립보드를 못 쓰는 환경에서는 직접 복사할 수 있는 창을 띄운다 (조용히 실패하지 않게)
            if (await copyText(inviteUrl)) setCopied(true);
            else showForManualCopy(inviteUrl);
          }}
        >
          {copied ? "✓ 복사됨" : "링크 복사"}
        </button>
        <Link href={`/project/${state.projectId}`} className={btnPrimary}>
          프로젝트로 이동 →
        </Link>
        <p className="text-center text-xs text-muted">링크는 나중에 프로젝트 화면 오른쪽 위 [초대 링크 복사]에서 다시 볼 수 있어요.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        내 닉네임
        <input name="nickname" required maxLength={20} placeholder="예) 코밋" aria-describedby="nickname-hint" className={inputClass} />
        {/* 회원가입이 없다는 걸 먼저 알려 망설이지 않게 한다 */}
        <span id="nickname-hint" className="text-xs font-normal text-muted">
          팀원에게 보이는 이름이에요. 회원가입은 필요 없어요.
        </span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span>프로젝트 이름 <span className="font-normal text-muted">(선택)</span></span>
        <input name="title" maxLength={50} placeholder="예) 우리 팀 프로젝트" className={inputClass} />
      </label>
      {/* 빈 에디터 앞에서 막막하지 않게, 바로 고쳐볼 수 있는 예제 코드로 시작할 수 있다 */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          어떤 코드로 시작할까요? <span className="font-normal text-muted">(선택)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {STARTER_TEMPLATES.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:bg-surface has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:font-semibold has-[:checked]:text-accent-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
            >
              <input type="radio" name="template" value={t.id} defaultChecked={t.id === DEFAULT_TEMPLATE_ID} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
        <span className="text-xs text-muted">예제를 고르면 그 코드가 팀의 첫 원본이 돼요. 나중에 에디터에서 자유롭게 고칠 수 있어요.</span>
      </fieldset>
      {state.error && <p role="alert" className={noticeError}>{state.error}</p>}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "만드는 중..." : "프로젝트 만들기"}
      </button>
    </form>
  );
}

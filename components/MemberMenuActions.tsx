"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { reissueRecoveryCode, transferLeader } from "@/app/actions/member";
import { copyText, showForManualCopy } from "@/lib/clipboard";
import { btnGhost, noticeError } from "@/lib/ui";

// 멤버 메뉴 안의 "팀장 넘기기" (팀장에게만 보인다). 실수로 누르지 않게 한 번 더 묻는다
export function TransferLeaderButton({ projectId, nickname }: { projectId: string; nickname: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setPending(true);
    const result = await transferLeader(projectId, nickname);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh(); // 내 역할이 팀원으로 바뀐 화면을 다시 그린다
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
        👑 팀장 넘기기
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span>{nickname}님을 팀장으로 세우고, 나는 팀원이 돼요. 계속할까요?</span>
      <div className="flex gap-1">
        <button type="button" disabled={pending} onClick={run} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
          {pending ? "넘기는 중..." : "넘기기"}
        </button>
        <button type="button" disabled={pending} onClick={() => setAsking(false)} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
          취소
        </button>
      </div>
      {error && <p role="alert" className={`${noticeError} !px-2 !py-1 !text-xs`}>{error}</p>}
    </div>
  );
}

// 멤버 메뉴 안의 "복구 코드 새로 받기". 새로 받으면 이전 코드는 쓸 수 없게 된다
export function ReissueCodeButton({ projectId }: { projectId: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    const result = await reissueRecoveryCode(projectId);
    setPending(false);
    if (result.recoveryCode) setCode(result.recoveryCode);
    else setError(result.error ?? "");
  }

  if (code) {
    return (
      <div className="flex flex-col gap-1 text-xs">
        <code className="break-all rounded-lg border border-line bg-surface p-2 text-center font-mono font-semibold">{code}</code>
        <span className="text-muted">지금만 보여요. 이전 코드는 더 못 써요.</span>
        <button
          type="button"
          className={`${btnGhost} !px-2 !py-1 !text-xs`}
          onClick={async () => {
            if (!(await copyText(code))) showForManualCopy(code);
          }}
        >
          코드 복사
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={pending} onClick={run} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
        {pending ? "만드는 중..." : "🔑 내 복구 코드 새로 받기"}
      </button>
      {error && <p role="alert" className={`${noticeError} !px-2 !py-1 !text-xs`}>{error}</p>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { regenerateInvite, reissueRecoveryCode, removeMember, transferLeader } from "@/app/actions/member";
import { deleteProject } from "@/app/actions/project";
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

// 프로젝트 삭제 (팀장에게만 보인다). 이름을 똑같이 입력해야 지워지고, 되돌릴 수 없다
export function DeleteProjectButton({ projectId, title }: { projectId: string; title: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setPending(true);
    const result = await deleteProject(projectId, name);
    setPending(false);
    if (result.error) setError(result.error);
    else router.push("/"); // 지운 프로젝트 화면에는 더 머물 수 없으니 첫 화면으로 간다
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${btnGhost} !px-2 !py-1 !text-xs !text-danger`}>
        🗑 프로젝트 삭제
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span>제출과 댓글까지 모두 지워지고 되돌릴 수 없어요. 계속하려면 프로젝트 이름 “{title}”을 입력하세요.</span>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className="rounded-lg border border-line-strong bg-background px-2 py-1" aria-label="프로젝트 이름 확인" />
      <div className="flex gap-1">
        <button type="button" disabled={pending || !name.trim()} onClick={run} className={`${btnGhost} !px-2 !py-1 !text-xs !text-danger`}>
          {pending ? "삭제 중..." : "영구 삭제"}
        </button>
        <button type="button" disabled={pending} onClick={() => setAsking(false)} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
          취소
        </button>
      </div>
      {error && <p role="alert" className={`${noticeError} !px-2 !py-1 !text-xs`}>{error}</p>}
    </div>
  );
}

// 멤버 메뉴 안의 "내보내기" (팀장에게만 보인다). 한 번 더 묻는다
export function RemoveMemberButton({ projectId, nickname }: { projectId: string; nickname: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setPending(true);
    const result = await removeMember(projectId, nickname);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh(); // 멤버 목록을 다시 그린다
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
        내보내기
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span>{nickname}님을 내보낼까요? 이미 올린 제출과 댓글은 남아요.</span>
      <div className="flex gap-1">
        <button type="button" disabled={pending} onClick={run} className={`${btnGhost} !px-2 !py-1 !text-xs !text-danger`}>
          {pending ? "내보내는 중..." : "내보내기"}
        </button>
        <button type="button" disabled={pending} onClick={() => setAsking(false)} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
          취소
        </button>
      </div>
      {error && <p role="alert" className={`${noticeError} !px-2 !py-1 !text-xs`}>{error}</p>}
    </div>
  );
}

// 초대 링크 새로 만들기 (팀장에게만 보인다). 이전 링크는 못 쓰게 되므로 한 번 더 묻는다
export function RegenerateInviteButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setPending(true);
    const result = await regenerateInvite(projectId);
    setPending(false);
    if (result.error) setError(result.error);
    else {
      setAsking(false);
      router.refresh(); // 새 링크가 헤더의 복사 버튼에 반영된다
    }
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
        🔗 초대 링크 새로 만들기
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span>이전 초대 링크는 더 쓸 수 없게 돼요. 이미 들어온 멤버는 그대로예요.</span>
      <div className="flex gap-1">
        <button type="button" disabled={pending} onClick={run} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
          {pending ? "만드는 중..." : "새로 만들기"}
        </button>
        <button type="button" disabled={pending} onClick={() => setAsking(false)} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
          취소
        </button>
      </div>
      {error && <p role="alert" className={`${noticeError} !px-2 !py-1 !text-xs`}>{error}</p>}
    </div>
  );
}

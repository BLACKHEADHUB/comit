"use client";

import { useState, useTransition } from "react";
import { linkProjectToClass, unlinkProjectFromClass } from "@/app/actions/classroom";
import { btnGhost, btnSecondary, card, inputClass, noticeError } from "@/lib/ui";

type Linked = { title: string; instructorName: string } | null;

// 기여도 리포트 아래: 이 프로젝트를 수업(반)에 연결하는 칸. 연결하면 강사가 이 리포트를 볼 수 있다.
// 팀장만 연결·해제할 수 있고, 팀원에게는 연결 상태만 보인다
export default function ClassLinkForm({ projectId, isLeader, linked: initial }: { projectId: string; isLeader: boolean; linked: Linked }) {
  const [linked, setLinked] = useState<Linked>(initial);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (!isLeader && !linked) return null;

  return (
    <section className={`${card} flex flex-col gap-2 p-4 text-sm print:hidden`} aria-label="수업 연결">
      <h2 className="font-semibold">🎓 수업 연결</h2>
      {linked ? (
        <>
          <p>
            <strong>{linked.title}</strong>
            {linked.instructorName && ` (${linked.instructorName})`} 수업에 연결돼 있어요. 강사님이 이 기여도 리포트를 볼 수 있어요. 코드와 댓글 내용은 보이지 않아요.
          </p>
          {isLeader && (
            <button
              type="button"
              disabled={pending}
              className={`${btnGhost} self-start !px-2 text-xs`}
              onClick={() =>
                startTransition(async () => {
                  const res = await unlinkProjectFromClass(projectId);
                  if (res.error) setError(res.error);
                  else setLinked(null);
                })
              }
            >
              연결 끊기
            </button>
          )}
        </>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            startTransition(async () => {
              const res = await linkProjectToClass(projectId, code);
              if (res.error) setError(res.error);
              else if (res.ok) setLinked({ title: res.title ?? "", instructorName: res.instructorName ?? "" });
            });
          }}
        >
          <p className="text-muted">강사님께 받은 반 코드를 넣으면, 강사님이 우리 팀의 기여도 리포트를 볼 수 있어요. 코드와 댓글 내용은 보이지 않아요.</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={20}
              placeholder="예) K7P2-XQ9M"
              aria-label="반 코드"
              className={`${inputClass} max-w-48 font-mono uppercase`}
            />
            <button type="submit" disabled={pending || !code.trim()} className={btnSecondary}>
              {pending ? "연결하는 중..." : "수업에 연결"}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className={noticeError}>{error}</p>}
    </section>
  );
}

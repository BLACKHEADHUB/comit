"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { linkProjectToClass, unlinkProjectFromClass } from "@/app/actions/classroom";
import { badge, btnGhost, btnPrimary, inputClass, modalCard, modalOverlay, noticeError } from "@/lib/ui";

type Linked = { title: string; instructorName: string } | null;

// 프로젝트 메인 화면 헤더용 "🎓 수업 연결" 버튼 + 모달.
// 기여도 화면까지 들어가지 않아도 팀장이 메인 화면에서 바로 반 코드를 입력해 교수님 수업에 연결할 수 있다.
export default function ClassLinkButton({
  projectId,
  isLeader,
  linked: initial,
}: {
  projectId: string;
  isLeader: boolean;
  linked: Linked;
}) {
  const router = useRouter();
  const [linked, setLinked] = useState<Linked>(initial);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  if (!isLeader && !linked) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className={
          linked
            ? `${badge} bg-ok-soft text-ok transition hover:opacity-85`
            : "rounded-full px-2 py-1 transition hover:bg-surface hover:text-foreground"
        }
        title={linked ? `${linked.title} 수업에 연결됨` : "강사님께 받은 반 코드로 수업 연결하기"}
      >
        🎓 {linked ? linked.title : "수업 연결"}
      </button>

      {open && (
        <div className={modalOverlay} onClick={() => !pending && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-link-modal-title"
            onClick={(e) => e.stopPropagation()}
            className={`${modalCard} flex flex-col gap-3`}
          >
            <h2 id="class-link-modal-title" className="text-base font-bold">
              🎓 수업 연결
            </h2>
            {linked ? (
              <>
                <p className="text-sm leading-relaxed text-muted">
                  <strong className="text-foreground">{linked.title}</strong>
                  {linked.instructorName && ` (${linked.instructorName})`} 수업에 연결돼 있어요. 강사님이 팀 기여도 리포트와 최종 병합된 코드를 볼 수 있어요. 작성 중인 초안과 댓글 내용은 보이지 않아요.
                </p>
                {error && <p role="alert" className={noticeError}>{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={pending} onClick={() => setOpen(false)} className={btnGhost}>
                    닫기
                  </button>
                  {isLeader && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setError("");
                        startTransition(async () => {
                          const res = await unlinkProjectFromClass(projectId);
                          if (res.error) {
                            setError(res.error);
                            return;
                          }
                          setLinked(null);
                          setOpen(false);
                          router.refresh();
                        });
                      }}
                      className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {pending ? "해제 중..." : "연결 끊기"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError("");
                  startTransition(async () => {
                    const res = await linkProjectToClass(projectId, code);
                    if (res.error) {
                      setError(res.error);
                      return;
                    }
                    if (res.ok) {
                      setLinked({ title: res.title ?? "", instructorName: res.instructorName ?? "" });
                      setCode("");
                      setOpen(false);
                      router.refresh();
                    }
                  });
                }}
              >
                <p className="text-sm leading-relaxed text-muted">
                  강사님께 받은 반 코드를 넣으면, 강사님이 우리 팀의 기여도 리포트와 최종 병합된 코드를 볼 수 있어요. 작성 중인 초안과 댓글 내용은 보이지 않아요.
                </p>
                <input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={20}
                  placeholder="예) K7P2-XQ9M"
                  aria-label="반 코드"
                  className={`${inputClass} font-mono uppercase`}
                />
                {error && <p role="alert" className={noticeError}>{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={pending} onClick={() => setOpen(false)} className={btnGhost}>
                    취소
                  </button>
                  <button type="submit" disabled={pending || !code.trim()} className={btnPrimary}>
                    {pending ? "연결 중..." : "수업에 연결"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

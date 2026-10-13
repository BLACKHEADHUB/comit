"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createComment } from "@/app/actions/comment";
import { summarizeChanges } from "@/lib/changes";
import AskAi from "@/components/AskAi";
import CommentThread from "@/components/CommentThread";
import Mascot from "@/components/Mascot";
import Loading from "@/components/Loading";
import { countOpen, groupByLine } from "@/lib/comments";
import { markReviewedOnce } from "@/lib/onboarding";
import { TAG_STYLE, TAGS } from "@/lib/tags";
import type { CommentTag } from "@/lib/validation";
import { useReview } from "@/components/ReviewProvider";
import { useIsDark } from "@/lib/useIsDark";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { badge, btnGhost, btnPrimary, card, inputClass, noticeError, RETRY_MESSAGE } from "@/lib/ui";

// Diff Viewer는 브라우저 전용이라 SSR을 끄고 불러온다
const DiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => <Loading text="바뀐 부분을 비교하고 있어요..." />,
});

type Props = {
  aiPanel?: React.ReactNode; // 서버에서 만든 AI 분석 카드 (넓은 화면에서는 댓글 위, 오른쪽 열에 놓는다)
  projectId: string;
  submissionId: string;
  beforeCode: string;
  afterCode: string;
};

export default function SubmissionDiff({ aiPanel, projectId, submissionId, beforeCode, afterCode }: Props) {
  const { comments, addComment, newIds, markSeen } = useReview();
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [tag, setTag] = useState<CommentTag>("LIKE");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dark = useIsDark();
  const narrow = useMediaQuery("(max-width: 767px)");
  const formRef = useRef<HTMLFormElement>(null);

  // 댓글 입력 폼이 열리면(또는 다른 줄로 바뀌면) 포커스를 폼으로 옮긴다 → 키보드만으로 이어서 입력할 수 있다
  useEffect(() => {
    if (activeLine === null) return;
    formRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeLine]);

  const changes = useMemo(() => summarizeChanges(beforeCode, afterCode), [beforeCode, afterCode]);
  // 태그별 개수 요약 (해결 안 된 원댓글만)
  const open = countOpen(comments);
  const counts = TAGS.map((t) => ({ ...t, count: open[t.tag] }));

  // 줄 번호별로 댓글 묶기 (Diff 줄 옆 말풍선과 옆 패널이 같은 묶음을 쓴다)
  const threads = groupByLine(comments);
  const threadByLine = new Map(threads.map((t) => [t.line, t]));

  // 줄을 고르면 그 줄의 "새 댓글" 표시는 본 것으로 처리한다
  function selectLine(line: number) {
    setActiveLine(line);
    markSeen(threadByLine.get(line)?.threads.flatMap((t) => [t.root.id, ...t.replies.map((r) => r.id)]) ?? []);
  }

  // 줄 옆 말풍선을 누르면: 그 줄을 강조하고, 옆 패널의 해당 댓글 묶음으로 이동한다
  function openThread(line: number) {
    selectLine(line);
    setError("");
    const target = document.getElementById(`line-comments-${line}`);
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    target?.focus({ preventScroll: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeLine === null) return;
    setPending(true);
    setError("");
    let result;
    try {
      result = await createComment(projectId, submissionId, activeLine, tag, content);
    } catch {
      result = { error: RETRY_MESSAGE };
    } finally {
      setPending(false);
    }
    if (result.error || !result.comment) {
      setError(result.error ?? RETRY_MESSAGE);
      return;
    }
    addComment(result.comment);
    markReviewedOnce(); // 첫 진입 체크리스트의 "리뷰 남기기" 완료 기록
    setContent("");
    setActiveLine(null);
    // 폼이 사라져도 포커스가 길을 잃지 않게, 방금 댓글을 단 줄의 묶음으로 옮긴다
    const line = result.comment.lineNumber;
    requestAnimationFrame(() => document.getElementById(`line-comments-${line}`)?.focus({ preventScroll: true }));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <h2 className="mr-1 text-base font-semibold tracking-tight">코드 변경</h2>
        {/* 얼마나 큰 변경인지 먼저 알려준다 (Comit 모달과 같은 표현) */}
        <span className="text-muted">
          원본에서 {changes.changed}줄 바뀜 · <span className="text-ok">+{changes.added} 추가</span> ·{" "}
          <span className="text-danger">−{changes.removed} 삭제</span>
        </span>
        <span aria-hidden className="hidden h-4 w-px bg-line-strong sm:block" />
        {counts.map((c) => (
          <span key={c.tag} className={`${badge} ${TAG_STYLE[c.tag]}`}>
            {c.emoji} {c.label} {c.count}
          </span>
        ))}
        {newIds.size > 0 && (
          <span role="status" className={`${badge} bg-accent-soft text-accent-ink`}>
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />새 댓글 {newIds.size}개
          </span>
        )}
        <span className="text-xs text-muted">변경 후 줄 옆의 + 를 누르면 댓글을 달 수 있어요. 💬 표시는 댓글이 달린 줄이에요.</span>
      </div>

      {/* 넓은 화면: 코드는 왼쪽에 크게, AI 분석과 댓글은 오른쪽 열. 좁은 화면: AI 분석 → 코드 → 댓글 순서 (order) */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className={`${card} comit-diff ${narrow ? "" : "comit-diff-split"} order-2 min-w-0 self-start overflow-x-auto text-sm lg:col-start-1 lg:row-start-1`}>
          <DiffViewer
            // 이 라이브러리는 alwaysShowLines가 바뀌어도 Diff를 다시 계산하지 않아 표가 통째로 비어 버린다.
            // 댓글이 달린 줄 목록이 바뀔 때마다 key를 바꿔 새로 그리게 한다
            key={threads.map((t) => t.line).join(",")}
            oldValue={beforeCode}
            newValue={afterCode}
            splitView={!narrow} // 좁은 화면에서는 좌우 분할 대신 한 줄 보기 (분할하면 글자가 한 자씩 줄바꿈된다)
            useDarkTheme={dark}
            leftTitle={narrow ? "− 변경 전 / + 변경 후" : "변경 전"}
            rightTitle="변경 후"
            // 지금 댓글을 다는 줄만 강조한다 (이 라이브러리는 줄마다 다른 색을 줄 수 없다)
            // 한 줄 보기에서 새로 추가된 줄은 라이브러리가 "undefined-줄번호"로 식별하므로 둘 다 넘긴다
            highlightLines={activeLine === null ? [] : [`R-${activeLine}`, `undefined-${activeLine}`]}
            // 댓글이 달린 줄은 변경이 없는 구간이라도 접히지 않게 한다
            alwaysShowLines={threads.map((t) => `R-${t.line}`)}
            // 줄 번호 옆 칸: "변경 후" 줄마다 버튼을 하나 둔다. 댓글이 있으면 말풍선(개수), 없으면 댓글 달기(+).
            // 줄 번호 칸은 키보드로 누를 수 없어서, 이 버튼이 키보드/터치 사용자의 댓글 입구가 된다
            renderGutter={({ lineNumber, prefix, additionalLineNumber, styles }) => {
              // 좌우 분할: 오른쪽 칸(prefix R)의 줄 번호 / 한 줄 보기: additionalLineNumber가 변경 후 줄 번호
              const line = additionalLineNumber ?? (prefix === "R" && lineNumber > 0 ? lineNumber : undefined);
              const thread = line === undefined ? undefined : threadByLine.get(line);
              return (
                <td className={styles.gutter} style={{ minWidth: 0, padding: line === undefined ? 0 : "0 2px", textAlign: "center" }}>
                  {thread ? (
                    // 해결 안 된 댓글이 있으면 개수(버그면 🐞), 전부 해결됐으면 ✓ 로 표시한다
                    <button
                      type="button"
                      onClick={() => openThread(thread.line)}
                      aria-label={
                        thread.openCount > 0
                          ? `${thread.line}번 줄 댓글 ${thread.openCount}개 보기${thread.hasOpenBug ? " (버그 지적 있음)" : ""}`
                          : `${thread.line}번 줄 해결된 댓글 보기`
                      }
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11px] font-semibold leading-4 transition hover:scale-105 ${
                        thread.openCount === 0
                          ? "bg-ok-soft text-ok"
                          : thread.hasOpenBug
                            ? "bg-danger-soft text-danger"
                            : "bg-accent-soft text-accent-ink"
                      }`}
                    >
                      {thread.openCount === 0 ? (
                        <span aria-hidden>✓</span>
                      ) : (
                        <>
                          <span aria-hidden>{thread.hasOpenBug ? "🐞" : "💬"}</span>
                          {thread.openCount}
                        </>
                      )}
                    </button>
                  ) : (
                    line !== undefined && (
                      <button
                        type="button"
                        onClick={() => selectLine(line)}
                        aria-label={`${line}번 줄에 댓글 달기`}
                        className="inline-flex size-4 items-center justify-center rounded-full text-[13px] leading-none text-muted opacity-70 transition hover:bg-accent hover:text-white hover:opacity-100 focus-visible:bg-accent focus-visible:text-white focus-visible:opacity-100"
                      >
                        <span aria-hidden>+</span>
                      </button>
                    )
                  )}
                </td>
              );
            }}
            styles={{
              // 코드 글자는 작성 화면의 에디터(16px)와 같은 크기로 맞춘다
              contentText: { fontSize: "16px", lineHeight: "26px" },
              lineNumber: { fontSize: "14px" },
              variables: {
                light: { highlightBackground: "#e0e7ff", highlightGutterBackground: "#c7d2fe" },
                dark: { highlightBackground: "#312e81", highlightGutterBackground: "#3730a3" },
              },
            }}
            // 접힌(변경 없는) 구간의 기본 문구 "@@ -a,n +b,n @@"를 입문자용 문구로 바꾼다
            codeFoldMessageRenderer={(total) => <span className="text-xs">변경 없는 {total}줄 펼치기</span>}
            onLineNumberClick={(lineId) => {
              // 오른쪽(R-) 줄 번호만 댓글 대상으로 사용
              if (!lineId.startsWith("R-")) return;
              selectLine(Number(lineId.slice(2)));
              setError("");
            }}
          />
        </div>

        {/* 좁은 화면에서는 contents로 풀어서 자식들이 위 grid의 order를 따르고, 넓은 화면에서는 따라다니는 오른쪽 열이 된다 */}
        <div className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:max-h-[calc(100dvh-2rem)] lg:flex-col lg:gap-4 lg:self-start lg:overflow-y-auto lg:sticky lg:top-4">
        {aiPanel && <div className="order-1">{aiPanel}</div>}
        <aside className="order-3 flex flex-col gap-4 text-sm">
          {activeLine !== null && (
            <form ref={formRef} onSubmit={handleSubmit} className={`${card} flex animate-pop-in flex-col gap-3 p-4`}>
              <p className="font-semibold">{activeLine}번 줄에 댓글</p>
              <div className="grid grid-cols-3 gap-1.5">
                {TAGS.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => setTag(t.tag)}
                    aria-pressed={tag === t.tag}
                    className={`rounded-full border px-1 py-1.5 text-xs transition active:scale-[0.97] ${
                      tag === t.tag
                        ? "border-accent bg-accent-soft font-semibold text-accent-ink"
                        : "border-line-strong text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="내용 (선택)"
                className={inputClass}
              />
              {error && <p role="alert" className={noticeError}>{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setActiveLine(null)} className={btnGhost}>
                  취소
                </button>
                <button type="submit" disabled={pending} className={btnPrimary}>
                  {pending ? "등록 중..." : error ? "다시 시도" : "등록하기"}
                </button>
              </div>
            </form>
          )}

          {/* 고른 줄에 대해 AI에게 물어보기 (줄이 바뀌면 이전 답변은 지운다: key) */}
          {activeLine !== null && <AskAi key={activeLine} projectId={projectId} submissionId={submissionId} line={activeLine} />}

          {threads.length === 0 && activeLine === null && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong p-5 text-center leading-relaxed text-muted">
              <Mascot mood="calm" size={48} />
              <p>
                아직 댓글이 없어요. 궁금하거나 칭찬하고 싶은 줄 옆의 <strong className="text-foreground">+</strong> 를 눌러 첫 댓글을
                남겨보세요. 칭찬 한마디도 좋은 리뷰예요!
              </p>
            </div>
          )}
          {threads.map((t) => (
            // 말풍선을 눌렀을 때 이동해 올 자리 (tabIndex=-1: 코드로만 포커스를 받는다)
            <div
              key={t.line}
              id={`line-comments-${t.line}`}
              tabIndex={-1}
              className={`scroll-mt-4 rounded-xl outline-none transition ${activeLine === t.line ? "ring-2 ring-accent/40 ring-offset-4 ring-offset-background" : ""}`}
            >
              <button
                type="button"
                onClick={() => selectLine(t.line)}
                className="mb-1.5 text-xs font-semibold text-muted transition hover:text-accent-ink"
              >
                {t.line}번 줄 · 댓글 {t.threads.length}개
                {t.openCount < t.threads.length && ` (해결 ${t.threads.length - t.openCount})`}
              </button>
              <ul className="flex flex-col gap-2">
                {t.threads.map((thread) => (
                  <CommentThread key={thread.root.id} projectId={projectId} submissionId={submissionId} thread={thread} />
                ))}
              </ul>
            </div>
          ))}
        </aside>
        </div>
      </div>
    </section>
  );
}

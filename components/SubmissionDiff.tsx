"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { createComment } from "@/app/actions/comment";
import { groupByLine } from "@/lib/comments";
import type { CommentTag } from "@/lib/validation";
import { useReview } from "@/components/ReviewProvider";
import { useIsDark } from "@/lib/useIsDark";
import { badge, btnGhost, btnPrimary, card, inputClass, noticeError, RETRY_MESSAGE } from "@/lib/ui";

// Diff Viewer는 브라우저 전용이라 SSR을 끄고 불러온다
const DiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted">Diff 불러오는 중...</p>,
});

const TAGS: { tag: CommentTag; emoji: string; label: string }[] = [
  { tag: "LIKE", emoji: "👍", label: "좋아요" },
  { tag: "QUESTION", emoji: "❓", label: "질문" },
  { tag: "BUG", emoji: "🐞", label: "버그" },
];
// 태그별 배지 색상 (LIKE=초록, QUESTION=포인트, BUG=빨강)
const TAG_STYLE: Record<CommentTag, string> = {
  LIKE: "bg-ok-soft text-ok",
  QUESTION: "bg-accent-soft text-accent",
  BUG: "bg-danger-soft text-danger",
};
// 화면에는 한국어 라벨을 쓰고, DB에는 기존 값(LIKE/QUESTION/BUG)이 그대로 저장된다
const emojiOf = (tag: CommentTag) => TAGS.find((t) => t.tag === tag)!.emoji;
const labelOf = (tag: CommentTag) => TAGS.find((t) => t.tag === tag)!.label;

// 서버/브라우저 시간대가 달라도 같은 결과가 나오도록 시간대 고정
const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type Props = {
  projectId: string;
  submissionId: string;
  beforeCode: string;
  afterCode: string;
};

export default function SubmissionDiff({ projectId, submissionId, beforeCode, afterCode }: Props) {
  const { comments, addComment } = useReview();
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [tag, setTag] = useState<CommentTag>("LIKE");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dark = useIsDark();

  // 태그별 개수 요약
  const counts = TAGS.map((t) => ({ ...t, count: comments.filter((c) => c.tag === t.tag).length }));

  // 줄 번호별로 댓글 묶기 (Diff 줄 옆 말풍선과 옆 패널이 같은 묶음을 쓴다)
  const threads = groupByLine(comments);
  const threadByLine = new Map(threads.map((t) => [t.line, t]));

  // 줄 옆 말풍선을 누르면: 그 줄을 강조하고, 옆 패널의 해당 댓글 묶음으로 이동한다
  function openThread(line: number) {
    setActiveLine(line);
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
    setContent("");
    setActiveLine(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <h2 className="mr-1 text-base font-semibold tracking-tight">코드 변경</h2>
        {counts.map((c) => (
          <span key={c.tag} className={`${badge} ${TAG_STYLE[c.tag]}`}>
            {c.emoji} {c.label} {c.count}
          </span>
        ))}
        <span className="text-xs text-muted">오른쪽(변경 후) 줄 번호를 클릭하면 댓글을 달 수 있어요. 💬 표시는 댓글이 달린 줄이에요.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={`${card} min-w-0 overflow-x-auto text-xs`}>
          <DiffViewer
            oldValue={beforeCode}
            newValue={afterCode}
            splitView
            useDarkTheme={dark}
            leftTitle="변경 전"
            rightTitle="변경 후"
            // 지금 댓글을 다는 줄만 강조한다 (이 라이브러리는 줄마다 다른 색을 줄 수 없다)
            highlightLines={activeLine === null ? [] : [`R-${activeLine}`]}
            // 댓글이 달린 줄은 변경이 없는 구간이라도 접히지 않게 한다
            alwaysShowLines={threads.map((t) => `R-${t.line}`)}
            // 줄 번호 옆 칸: 댓글이 달린 "변경 후" 줄에 말풍선 버튼을 그린다 (왼쪽/댓글 없는 줄은 빈 칸)
            renderGutter={({ lineNumber, prefix, styles }) => {
              const thread = prefix === "R" ? threadByLine.get(lineNumber) : undefined;
              return (
                <td className={styles.gutter} style={{ minWidth: 0, padding: "0 2px", textAlign: "center" }}>
                  {thread && (
                    <button
                      type="button"
                      onClick={() => openThread(thread.line)}
                      aria-label={`${thread.line}번 줄 댓글 ${thread.comments.length}개 보기${thread.hasBug ? " (버그 지적 있음)" : ""}`}
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11px] font-semibold leading-4 transition hover:scale-105 ${
                        thread.hasBug ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"
                      }`}
                    >
                      <span aria-hidden>{thread.hasBug ? "🐞" : "💬"}</span>
                      {thread.comments.length}
                    </button>
                  )}
                </td>
              );
            }}
            styles={{
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
              setActiveLine(Number(lineId.slice(2)));
              setError("");
            }}
          />
        </div>

        <aside className="flex flex-col gap-4 text-sm lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
          {activeLine !== null && (
            <form onSubmit={handleSubmit} className={`${card} flex animate-pop-in flex-col gap-3 p-4`}>
              <p className="font-semibold">{activeLine}번 줄에 댓글</p>
              <div className="grid grid-cols-3 gap-1.5">
                {TAGS.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => setTag(t.tag)}
                    aria-pressed={tag === t.tag}
                    className={`rounded-lg border px-1 py-1.5 text-xs transition active:scale-[0.97] ${
                      tag === t.tag
                        ? "border-accent bg-accent-soft font-semibold text-accent"
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

          {threads.length === 0 && activeLine === null && (
            <p className="rounded-xl border border-dashed border-line-strong p-4 text-center leading-relaxed text-muted">
              아직 댓글이 없어요. 궁금하거나 칭찬하고 싶은 줄의 번호를 눌러 첫 댓글을 남겨보세요.
            </p>
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
                onClick={() => setActiveLine(t.line)}
                className="mb-1.5 text-xs font-semibold text-muted transition hover:text-accent"
              >
                {t.line}번 줄 · 댓글 {t.comments.length}개
              </button>
              <ul className="flex flex-col gap-2">
                {t.comments.map((c) => (
                  <li key={c.id} className={`${card} p-3`}>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className={`${badge} ${TAG_STYLE[c.tag]}`}>{emojiOf(c.tag)} {labelOf(c.tag)}</span>
                      <span className="font-medium text-foreground">{c.author}</span>
                      <span>{formatTime(c.createdAt)}</span>
                    </p>
                    {/* 댓글은 텍스트로만 렌더링 (React가 자동 이스케이프) */}
                    {c.content && <p className="mt-1.5 whitespace-pre-wrap break-words leading-relaxed">{c.content}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}

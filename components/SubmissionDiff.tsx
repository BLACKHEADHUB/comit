"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { createComment } from "@/app/actions/comment";
import type { CommentItem, CommentTag } from "@/lib/validation";
import { btnGhost, btnPrimary, inputClass, RETRY_MESSAGE } from "@/lib/ui";

// Diff Viewer는 브라우저 전용이라 SSR을 끄고 불러온다
const DiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-zinc-500">Diff 불러오는 중...</p>,
});

const TAGS: { tag: CommentTag; emoji: string; label: string }[] = [
  { tag: "LIKE", emoji: "👍", label: "LIKE" },
  { tag: "QUESTION", emoji: "❓", label: "QUESTION" },
  { tag: "BUG", emoji: "🐞", label: "BUG" },
];
const emojiOf = (tag: CommentTag) => TAGS.find((t) => t.tag === tag)!.emoji;

// 서버/브라우저 시간대가 달라도 같은 결과가 나오도록 시간대 고정
const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// 시스템 다크모드를 구독해 Diff 색상도 맞춘다 (서버 렌더에서는 라이트로 가정)
const subscribeDark = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

type Props = {
  projectId: string;
  submissionId: string;
  beforeCode: string;
  afterCode: string;
  initialComments: CommentItem[];
};

export default function SubmissionDiff({ projectId, submissionId, beforeCode, afterCode, initialComments }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [tag, setTag] = useState<CommentTag>("LIKE");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dark = useSyncExternalStore(subscribeDark, getDark, () => false);

  // 태그별 개수 요약
  const counts = TAGS.map((t) => ({ ...t, count: comments.filter((c) => c.tag === t.tag).length }));

  // 줄 번호별로 댓글 묶기 (댓글이 있는 줄은 Diff에서 강조)
  const byLine = new Map<number, CommentItem[]>();
  for (const c of comments) byLine.set(c.lineNumber, [...(byLine.get(c.lineNumber) ?? []), c]);
  const lines = [...byLine.keys()].sort((a, b) => a - b);

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
    setComments((prev) => [...prev, result.comment!]);
    setContent("");
    setActiveLine(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <h2 className="font-bold">코드 변경</h2>
        {counts.map((c) => (
          <span key={c.tag} className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            {c.emoji} {c.count}
          </span>
        ))}
        <span className="text-zinc-500">오른쪽(변경 후) 줄 번호를 클릭하면 댓글을 달 수 있어요.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 overflow-x-auto rounded-lg border border-zinc-300 text-xs dark:border-zinc-700">
          <DiffViewer
            oldValue={beforeCode}
            newValue={afterCode}
            splitView
            useDarkTheme={dark}
            leftTitle="변경 전"
            rightTitle="변경 후"
            highlightLines={lines.map((n) => `R-${n}`)}
            onLineNumberClick={(lineId) => {
              // 오른쪽(R-) 줄 번호만 댓글 대상으로 사용
              if (!lineId.startsWith("R-")) return;
              setActiveLine(Number(lineId.slice(2)));
              setError("");
            }}
          />
        </div>

        <aside className="flex flex-col gap-4 text-sm">
          {activeLine !== null && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
              <p className="font-medium">{activeLine}번 줄에 댓글</p>
              <div className="flex gap-1">
                {TAGS.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => setTag(t.tag)}
                    className={`flex-1 rounded-lg border px-2 py-1 ${tag === t.tag ? "border-zinc-900 bg-zinc-200 font-bold dark:border-zinc-100 dark:bg-zinc-700" : "border-zinc-300 dark:border-zinc-700"}`}
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
              {error && <p role="alert" className="text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setActiveLine(null)} className={btnGhost}>
                  취소
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={btnPrimary}
                >
                  {pending ? "등록 중..." : error ? "다시 시도" : "등록하기"}
                </button>
              </div>
            </form>
          )}

          {lines.length === 0 && activeLine === null && (
            <p className="text-zinc-500">아직 댓글이 없어요. 궁금하거나 칭찬하고 싶은 줄의 번호를 눌러 첫 댓글을 남겨보세요.</p>
          )}
          {lines.map((n) => (
            <div key={n}>
              <button
                type="button"
                onClick={() => setActiveLine(n)}
                className="mb-1 font-medium hover:underline"
              >
                {n}번 줄
              </button>
              <ul className="flex flex-col gap-2">
                {byLine.get(n)!.map((c) => (
                  <li key={c.id} className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900">
                    <p className="text-xs text-zinc-500">
                      {emojiOf(c.tag)} {c.author} · {formatTime(c.createdAt)}
                    </p>
                    {/* 댓글은 텍스트로만 렌더링 (React가 자동 이스케이프) */}
                    {c.content && <p className="mt-1 whitespace-pre-wrap break-words">{c.content}</p>}
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

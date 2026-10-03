"use client";

import { useState } from "react";
import { createReply, setCommentResolved } from "@/app/actions/comment";
import { useReview } from "@/components/ReviewProvider";
import { canResolve, type Thread } from "@/lib/comments";
import { formatTime, TAG_STYLE, tagMeta } from "@/lib/tags";
import { badge, btnGhost, btnPrimary, card, inputClass, noticeError, RETRY_MESSAGE } from "@/lib/ui";
import type { CommentItem } from "@/lib/validation";

const smallBtn = `${btnGhost} !px-2 !py-1 !text-xs`;

// 자동 갱신으로 방금 들어온 댓글/답글: 점 + 글자로 알려준다
function NewMark({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 font-medium text-accent-ink">
      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
      {label}
    </span>
  );
}

type Props = { projectId: string; submissionId: string; thread: Thread<CommentItem> };

// 원댓글 하나 + 답글들 + [답글] / [해결] 버튼
export default function CommentThread({ projectId, submissionId, thread }: Props) {
  const { root, replies } = thread;
  const { viewer, addComment, updateComment, newIds } = useReview();
  const [replyOpen, setReplyOpen] = useState(false);
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // 버튼은 권한이 있는 사람에게만 보여준다 (서버 액션에서도 같은 규칙으로 다시 확인한다)
  const mayResolve = canResolve(viewer, root.author, viewer.submissionAuthor);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    let result;
    try {
      result = await createReply(projectId, submissionId, root.id, content);
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
    setReplyOpen(false);
  }

  async function handleResolve(resolved: boolean) {
    setPending(true);
    setError("");
    let result;
    try {
      result = await setCommentResolved(projectId, submissionId, root.id, resolved);
    } catch {
      result = { error: RETRY_MESSAGE };
    } finally {
      setPending(false);
    }
    if (result.error || !result.comment) {
      setError(result.error ?? RETRY_MESSAGE);
      return;
    }
    updateComment(result.comment);
  }

  return (
    <li className={`${card} p-3 ${root.resolved ? "bg-surface" : ""}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {root.tag && (
          <span className={`${badge} ${TAG_STYLE[root.tag]}`}>
            {tagMeta(root.tag).emoji} {tagMeta(root.tag).label}
          </span>
        )}
        <span className="font-medium text-foreground">{root.author}</span>
        <span>{formatTime(root.createdAt)}</span>
        {/* 해결 여부는 색이 아니라 ✓ 기호와 글자로 알려준다 */}
        {root.resolved && <span className={`${badge} bg-ok-soft text-ok`}>✓ 해결됨</span>}
        {newIds.has(root.id) && <NewMark label="새 댓글" />}
      </p>
      {/* 댓글은 텍스트로만 렌더링 (React가 자동 이스케이프) */}
      {root.content && (
        <p className={`mt-1.5 whitespace-pre-wrap break-words leading-relaxed ${root.resolved ? "text-muted" : ""}`}>{root.content}</p>
      )}

      {replies.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-2 border-l-2 border-line pl-3">
          {replies.map((r) => (
            <li key={r.id}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                <span aria-hidden>↳</span>
                <span className="font-medium text-foreground">{r.author}</span>
                <span>{formatTime(r.createdAt)}</span>
                {newIds.has(r.id) && <NewMark label="새 답글" />}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words leading-relaxed">{r.content}</p>
            </li>
          ))}
        </ul>
      )}

      {replyOpen ? (
        <form onSubmit={handleReply} className="mt-2.5 flex flex-col gap-2">
          <textarea
            autoFocus
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={300}
            rows={2}
            aria-label={`${root.author}님의 댓글에 답글`}
            placeholder="답글을 적어보세요"
            className={inputClass}
          />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setReplyOpen(false)} className={smallBtn}>
              취소
            </button>
            <button type="submit" disabled={pending} className={`${btnPrimary} !px-3 !py-1 !text-xs`}>
              {pending ? "등록 중..." : "답글 등록"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => setReplyOpen(true)} className={smallBtn}>
            ↩ 답글
          </button>
          {mayResolve && (
            <button type="button" disabled={pending} onClick={() => handleResolve(!root.resolved)} className={smallBtn}>
              {root.resolved ? "↺ 다시 열기" : "✓ 해결"}
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className={`${noticeError} mt-2 !text-xs`}>{error}</p>}
    </li>
  );
}

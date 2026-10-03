"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { OnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createSubmission } from "@/app/actions/submission";
import ChangePreview from "@/components/ChangePreview";
import { changedLineMarks, summarizeChanges } from "@/lib/changes";
import {
  clearDraft,
  LANGUAGES,
  readDraft,
  readLanguage,
  subscribeLanguage,
  writeDraft,
  writeLanguage,
  type Language,
} from "@/lib/draft";
import type { SubmissionItem } from "@/lib/validation";
import { useIsDark } from "@/lib/useIsDark";
import {
  badge,
  btnGhost,
  btnPrimary,
  btnSecondary,
  inputClass,
  modalCard,
  modalOverlay,
  noticeError,
  noticeWarn,
  RETRY_MESSAGE,
  STALE_HINT,
  STALE_LABEL,
} from "@/lib/ui";

// Monaco는 브라우저 전용이라 SSR을 끄고 불러온다
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted">에디터 불러오는 중...</p>,
});

const TABS = [
  { status: "PENDING", label: "대기" },
  { status: "MERGED", label: "병합됨" },
  { status: "STALE", label: STALE_LABEL },
] as const;

// 서버/브라우저 시간대가 달라도 같은 결과가 나오도록 시간대를 고정한다 (hydration 불일치 방지)
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
  initialCode: string;
  initialSubmissions: SubmissionItem[];
};

export default function ProjectWorkspace({ projectId, initialCode, initialSubmissions }: Props) {
  // 저장된 초안이 있으면(상세 페이지에서 돌아왔거나 STALE 코드를 불러온 경우) 그 코드로 시작한다.
  // 에디터는 브라우저에서만 그려지므로 서버/클라이언트 초기값이 달라도 화면 불일치가 생기지 않는다
  const [code, setCode] = useState(() =>
    typeof window === "undefined" ? initialCode : (readDraft(projectId, initialCode)?.code ?? initialCode)
  );
  // STALE 안내 배너는 마크업이 달라지므로 useSyncExternalStore로 안전하게 읽는다 (서버에서는 항상 false)
  const fromStale = useSyncExternalStore(
    () => () => {},
    () => readDraft(projectId, initialCode)?.fromStale ?? false,
    () => false
  );
  const [staleDismissed, setStaleDismissed] = useState(false);
  // 언어 선택은 탭에 저장해 상세 페이지에 다녀와도 유지한다 (서버 렌더에서는 일반 텍스트)
  const language = useSyncExternalStore(subscribeLanguage, () => readLanguage(projectId), () => "plaintext" as Language);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [tab, setTab] = useState<(typeof TABS)[number]["status"]>("PENDING");
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  function handleCodeChange(value: string) {
    setCode(value);
    writeDraft(projectId, { code: value, base: initialCode, fromStale: fromStale && !staleDismissed });
  }

  // 최신 mainCode로 되돌리기: 초안을 지우고 에디터를 서버가 준 최신 코드로 되돌린다
  function resetToMain() {
    clearDraft(projectId);
    setCode(initialCode);
    setStaleDismissed(true);
  }

  const dark = useIsDark();

  // 원본(mainCode)과 달라진 줄을 에디터 줄 번호 옆에 색 띠로 표시한다
  const summary = useMemo(() => summarizeChanges(initialCode, code), [initialCode, code]);
  type MonacoEditor = Parameters<OnMount>[0];
  const [editor, setEditor] = useState<MonacoEditor | null>(null);
  useEffect(() => {
    if (!editor) return;
    const { added, modified, deletedAt } = changedLineMarks(initialCode, code);
    const mark = (line: number, className: string, tooltip: string) => ({
      range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
      options: { linesDecorationsClassName: className, linesDecorationsTooltip: tooltip },
    });
    const decorations = [
      ...added.map((n) => mark(n, "comit-line-added", "원본에 없던 새 줄")),
      ...modified.map((n) => mark(n, "comit-line-modified", "원본에서 고친 줄")),
      ...deletedAt.map((n) => mark(n, "comit-line-deleted", "이 위에서 원본의 줄이 지워졌어요")),
    ];
    const collection = editor.createDecorationsCollection(decorations);
    return () => collection.clear(); // 코드가 바뀌면 이전 표시를 지우고 새로 그린다
  }, [editor, initialCode, code]);

  // ESC 키로 제출 모달 닫기
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModalOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const visible = submissions.filter((s) => s.status === tab);
  const hasChanges = summary.changed > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    let result;
    try {
      result = await createSubmission(projectId, title, code);
    } catch {
      result = { error: RETRY_MESSAGE }; // 네트워크 오류 등: 모달을 유지해 바로 다시 시도할 수 있게 한다
    } finally {
      setPending(false);
    }

    if (result.error || !result.submission) {
      setError(result.error ?? RETRY_MESSAGE);
      return;
    }
    // 성공: 사이드바 맨 위에 추가하고 대기 탭으로 이동
    setSubmissions((prev) => [result.submission!, ...prev]);
    setTab("PENDING");
    setTitle("");
    setNotice(result.notice ?? "");
    setModalOpen(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="flex max-h-56 shrink-0 flex-col border-b border-line bg-surface md:max-h-none md:w-72 md:border-r md:border-b-0">
        <div className="flex gap-1 border-b border-line p-2">
          {TABS.map((t) => {
            const count = submissions.filter((s) => s.status === t.status).length;
            const active = tab === t.status;
            return (
              <button
                key={t.status}
                type="button"
                onClick={() => setTab(t.status)}
                title={t.status === "STALE" ? STALE_HINT : undefined} // 마우스를 올리면 설명이 보인다
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[13px] leading-tight transition ${
                  active ? "bg-background font-medium shadow-sm ring-1 ring-line" : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
                <span className={`${badge} ${active ? "bg-accent-soft text-accent" : "bg-line text-muted"} !px-1.5 !py-0`}>{count}</span>
              </button>
            );
          })}
        </div>
        <ul className="flex-1 space-y-1.5 overflow-y-auto p-2">
          {visible.length === 0 && (
            <li className="rounded-lg border border-dashed border-line-strong p-4 text-center text-sm leading-relaxed text-muted">
              {tab === "PENDING"
                ? "아직 리뷰를 기다리는 제출이 없어요. 코드를 고친 뒤 아래 [Comit하기]를 눌러 팀원에게 보여주세요."
                : tab === "MERGED"
                  ? "아직 병합된 제출이 없어요. 팀장이 병합하면 여기에 모여요."
                  : "다시 제출할 항목이 없어요. 다른 변경이 먼저 병합되면, 최신 코드로 다시 제출해야 하는 제출이 여기에 표시돼요."}
            </li>
          )}
          {visible.map((s) => (
            <li key={s.id}>
              <Link
                href={`/project/${projectId}/submission/${s.id}`}
                className="block rounded-lg border border-transparent bg-background p-3 shadow-sm ring-1 ring-line transition hover:-translate-y-px hover:shadow-md hover:ring-line-strong"
              >
                <p className="truncate text-sm font-medium">{s.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {s.author} · {formatTime(s.createdAt)}
                </p>
                {/* 열어보지 않아도 알 수 있게: 댓글 수 / 버그 지적 수 / AI 경고 (있을 때만 표시) */}
                {(s.commentCount > 0 || s.hasWarning) && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {s.commentCount > 0 && (
                      <span aria-label={`댓글 ${s.commentCount}개`} className={`${badge} bg-surface text-muted ring-1 ring-line !px-1.5`}>
                        <span aria-hidden>💬</span> {s.commentCount}
                      </span>
                    )}
                    {s.bugCount > 0 && (
                      <span aria-label={`버그 지적 ${s.bugCount}개`} className={`${badge} bg-danger-soft text-danger !px-1.5`}>
                        <span aria-hidden>🐞</span> {s.bugCount}
                      </span>
                    )}
                    {s.hasWarning && (
                      <span className={`${badge} bg-warn-soft text-warn !px-1.5`}>
                        <span aria-hidden>⚠</span> AI 경고
                      </span>
                    )}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {fromStale && !staleDismissed && (
          <div className={`${noticeWarn} m-3 flex flex-wrap items-center gap-2 !rounded-lg`}>
            <span className="flex-1">
              충돌했던 제출의 코드를 불러왔어요. 다른 사람이 먼저 바꾼 내용이 있을 수 있으니, 확인하고 고친 뒤 다시 Comit하세요.
            </span>
            <button type="button" onClick={resetToMain} className={`${btnSecondary} !px-2.5 !py-1 !text-xs`}>
              최신 코드로 되돌리기
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-4 py-2">
          <p className="min-w-0 flex-1 basis-64 text-xs text-muted">
            코드를 자유롭게 고쳐보세요. 다 됐다면 아래 [Comit하기]로 팀원에게 리뷰를 요청해요. (작성 중인 코드는 이 브라우저 탭에 임시 저장돼요)
          </p>
          {/* 원본과 얼마나 달라졌는지 글자로도 알려준다 (색 띠만으로 구분하지 않게) */}
          <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {summary.changed === 0 ? (
              <span className="text-muted">원본과 같아요</span>
            ) : (
              <>
                <span className="font-medium">원본에서 {summary.changed}줄 바뀜</span>
                <span className="flex items-center gap-1 text-ok">
                  <span aria-hidden className="inline-block h-3 w-1 rounded-sm bg-ok" />+{summary.added} 추가
                </span>
                <span className="flex items-center gap-1 text-danger">
                  <span aria-hidden className="inline-block h-0.5 w-2.5 bg-danger" />−{summary.removed} 삭제
                </span>
              </>
            )}
          </p>
          <label className="flex items-center gap-2 text-xs text-muted">
            언어
            <select
              value={language}
              onChange={(e) => writeLanguage(projectId, e.target.value as Language)}
              className="rounded-md border border-line-strong bg-background px-2 py-1 text-xs text-foreground"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="min-h-64 flex-1">
          <Editor
            height="100%"
            language={language}
            theme={dark ? "vs-dark" : "light"}
            value={code}
            onChange={(v) => handleCodeChange(v ?? "")}
            onMount={(mounted) => setEditor(mounted)}
            options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 12 }, scrollBeyondLastLine: false }}
          />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-line bg-surface px-4 py-3">
          {notice && <p role="status" className="flex-1 text-sm text-warn">{notice}</p>}
          <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
            Comit하기
          </button>
        </div>
      </section>

      {modalOpen && (
        <div className={modalOverlay} onClick={() => !pending && setModalOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="comit-modal-title"
            className={`${modalCard} flex max-h-[calc(100dvh-2rem)] !max-w-xl flex-col gap-4 overflow-y-auto`}
          >
            <div>
              <h2 id="comit-modal-title" className="text-lg font-semibold tracking-tight">무엇을 바꿨나요?</h2>
              <p className="mt-1 text-sm text-muted">보내기 전에 바뀐 부분을 확인하고, 팀원이 알아보기 쉽게 한 줄로 적어주세요.</p>
            </div>
            {/* 보내기 전 확인: 원본과 달라진 부분만 보여준다 */}
            <ChangePreview before={initialCode} after={code} />
            <input
              autoFocus={hasChanges}
              required
              disabled={!hasChanges}
              aria-label="제출 제목"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 로그인 버튼 추가"
              className={inputClass}
            />
            {error && <p role="alert" className={noticeError}>{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} disabled={pending} className={btnGhost}>
                취소
              </button>
              {/* 원본과 같으면 보낼 것이 없으므로 제출을 막는다 (서버에서도 다시 확인한다) */}
              <button type="submit" disabled={pending || !hasChanges} className={btnPrimary}>
                {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {pending ? "AI가 분석하는 중... (최대 15초)" : error ? "다시 시도" : "제출하기"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

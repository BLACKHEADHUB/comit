"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { OnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createSubmission } from "@/app/actions/submission";
import ChangePreview from "@/components/ChangePreview";
import FlowSteps from "@/components/FlowSteps";
import OnboardingCard from "@/components/OnboardingCard";
import { byCreatedDesc, mergeById, newActivityIds } from "@/lib/activity";
import { writingFlow } from "@/lib/flow";
import { startPolling } from "@/lib/polling";
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
  STATUS_META,
} from "@/lib/ui";
import { filterSubmissions, inTab, TAB_FILTERS, type StatusFilter, type TaskTab } from "@/lib/tasks";

// Monaco는 브라우저 전용이라 SSR을 끄고 불러온다
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted">에디터 불러오는 중...</p>,
});

// 사이드바 탭: "내가 할 일" 기준 (탭 안에서 상태 칩으로 한 번 더 거를 수 있다)
const TABS: { tab: TaskTab; label: string; hint: string }[] = [
  { tab: "REVIEW", label: "리뷰할 것", hint: "팀원이 올린 제출 중 아직 병합 전인 것" },
  { tab: "MINE", label: "내 제안", hint: "내가 Comit한 제출 전부" },
  { tab: "HISTORY", label: "반영된 기록", hint: "병합됐거나 다시 제출이 필요한 제출" },
];

const FILTER_LABEL: Record<StatusFilter, string> = {
  ALL: "전체",
  PENDING: STATUS_META.PENDING.label,
  MERGED: STATUS_META.MERGED.label,
  STALE: STATUS_META.STALE.label,
};

// 목록이 비었을 때, 다음에 뭘 하면 되는지 알려주는 문구
function emptyMessage(tab: TaskTab, filter: StatusFilter) {
  if (tab === "REVIEW") return "지금 리뷰할 제출이 없어요. 팀원이 [Comit하기]로 코드를 올리면 여기에 나타나요.";
  if (tab === "MINE") {
    if (filter === "ALL") return "아직 올린 제출이 없어요. 코드를 고친 뒤 아래 [Comit하기]를 눌러 팀원에게 보여주세요.";
    if (filter === "PENDING") return "리뷰를 기다리는 내 제출이 없어요.";
    if (filter === "MERGED") return "아직 병합된 내 제출이 없어요. 팀장이 병합하면 여기에 모여요.";
    return "다시 제출할 항목이 없어요.";
  }
  return filter === "MERGED"
    ? "아직 병합된 제출이 없어요. 팀장이 병합하면 여기에 모여요."
    : "다시 제출할 항목이 없어요. 다른 변경이 먼저 병합되면, 최신 코드로 다시 제출해야 하는 제출이 여기에 표시돼요.";
}

// 서버/브라우저 시간대가 달라도 같은 결과가 나오도록 시간대를 고정한다 (hydration 불일치 방지)
const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const POLL_MS = 15_000;

type Props = {
  projectId: string;
  myNickname: string; // "내 제안 / 리뷰할 것"을 나누는 기준
  initialCode: string;
  initialSubmissions: SubmissionItem[];
};

export default function ProjectWorkspace({ projectId, myNickname, initialCode, initialSubmissions }: Props) {
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
  const [confirmReset, setConfirmReset] = useState(false); // "원본으로 되돌리기" 확인 단계
  // 언어 선택은 탭에 저장해 상세 페이지에 다녀와도 유지한다 (서버 렌더에서는 일반 텍스트)
  const language = useSyncExternalStore(subscribeLanguage, () => readLanguage(projectId), () => "plaintext" as Language);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  // 자동 갱신으로 새 활동(새 제출, 새 댓글)이 생긴 제출 id. 카드와 탭에 작은 점으로 표시한다
  const [unseen, setUnseen] = useState<ReadonlySet<string>>(new Set());
  const latestSubmissions = useRef(submissions); // 폴링 콜백에서 "지금 목록"과 비교하기 위한 최신 값
  useEffect(() => {
    latestSubmissions.current = submissions;
  }, [submissions]);

  // 자동 갱신: 창에 포커스가 돌아올 때 + 15초마다 목록을 다시 가져온다 (숨은 탭에서는 멈춤)
  useEffect(() => {
    return startPolling(async () => {
      const res = await fetch(`/api/project/${projectId}/submissions`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { submissions: SubmissionItem[] };
      const fresh = newActivityIds(latestSubmissions.current, data.submissions, myNickname);
      if (fresh.length > 0) setUnseen((prev) => new Set([...prev, ...fresh]));
      setSubmissions((prev) => mergeById(prev, data.submissions).sort(byCreatedDesc));
    }, POLL_MS);
  }, [projectId, myNickname]);

  const [tab, setTab] = useState<TaskTab>("REVIEW");
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  // 탭을 바꾸면 그 탭의 기본 상태 필터로 되돌린다
  function selectTab(next: TaskTab, nextFilter: StatusFilter = TAB_FILTERS[next][0]) {
    setTab(next);
    setFilter(nextFilter);
  }
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
  // 저장된 초안은 브라우저에만 있어서, 서버가 그린 화면과 글자가 달라지지 않도록(hydration 불일치 방지)
  // 브라우저에서 준비가 끝난 뒤에만 실제 변경 요약을 쓴다. 그 전에는 "변경 없음"으로 그린다
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const summary = useMemo(
    () => (hydrated ? summarizeChanges(initialCode, code) : { added: 0, removed: 0, changed: 0 }),
    [hydrated, initialCode, code]
  );
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

  const visible = filterSubmissions(submissions, tab, myNickname, filter);
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
    // 성공: 사이드바 맨 위에 추가하고 "내 제안" 탭으로 이동
    setSubmissions((prev) => [result.submission!, ...prev]);
    selectTab("MINE");
    setTitle("");
    setNotice(result.notice ?? "");
    setModalOpen(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="flex max-h-56 shrink-0 flex-col border-b border-line bg-surface md:max-h-none md:w-72 md:border-r md:border-b-0">
        {/* 탭은 글자 길이만큼만 차지한다 (똑같이 3등분하면 긴 라벨이 두 줄로 잘린다) */}
        <div role="tablist" aria-label="제출 목록 보기" className="flex justify-between gap-0.5 overflow-x-auto border-b border-line p-2">
          {TABS.map((t) => {
            const inThisTab = submissions.filter((s) => inTab(s, t.tab, myNickname));
            const count = inThisTab.length;
            const active = tab === t.tab;
            const hasNew = inThisTab.some((s) => unseen.has(s.id));
            return (
              <button
                key={t.tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.tab)}
                title={t.hint} // 마우스를 올리면 설명이 보인다
                className={`flex items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] leading-tight transition ${
                  active ? "bg-background font-medium shadow-sm ring-1 ring-line" : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
                <span className={`${badge} ${active ? "bg-accent-soft text-accent" : "bg-line text-muted"} !px-1.5 !py-0 !text-[11px]`}>{count}</span>
                {hasNew && (
                  <>
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="sr-only">새 활동 있음</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {/* 탭 안에서 상태로 한 번 더 거르기 (고를 상태가 하나뿐인 탭에서는 숨긴다) */}
        {TAB_FILTERS[tab].length > 1 && (
          <div role="group" aria-label="상태로 거르기" className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
            {TAB_FILTERS[tab].map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                title={f === "STALE" ? STALE_HINT : undefined}
                className={`rounded-full px-2 py-0.5 text-xs transition ${
                  filter === f ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>
        )}
        <ul className="flex-1 space-y-1.5 overflow-y-auto p-2">
          {visible.length === 0 && (
            <li className="rounded-lg border border-dashed border-line-strong p-4 text-center text-sm leading-relaxed text-muted">
              {emptyMessage(tab, filter)}
            </li>
          )}
          {visible.map((s) => (
            <li key={s.id}>
              <Link
                href={`/project/${projectId}/submission/${s.id}`}
                className="block rounded-lg border border-transparent bg-background p-3 shadow-sm ring-1 ring-line transition hover:-translate-y-px hover:shadow-md hover:ring-line-strong"
              >
                <p className="flex items-center gap-1.5">
                  {/* 상태가 섞여 보이는 탭이 있어 카드마다 상태를 아이콘+글자로 표시한다 */}
                  <span
                    title={s.status === "STALE" ? STALE_HINT : undefined}
                    className={`${badge} ${STATUS_META[s.status].style} shrink-0 !px-1.5 !py-0 !text-[11px]`}
                  >
                    <span aria-hidden>{STATUS_META[s.status].icon}</span>
                    {STATUS_META[s.status].label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title}</span>
                  {/* 자동 갱신으로 새로 올라왔거나 새 댓글이 달린 제출 */}
                  {unseen.has(s.id) && (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-accent">
                      <span aria-hidden className="size-1.5 rounded-full bg-accent" />새 활동
                    </span>
                  )}
                </p>
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
        {/* 첫 진입 안내 (닫으면 다시 나오지 않는다) */}
        <OnboardingCard hasChanges={hasChanges} hasSubmitted={submissions.some((s) => s.author === myNickname)} />
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
                {/* 망쳤다 싶을 때 되돌릴 길: 작성한 내용이 사라지므로 한 번 더 묻는다 */}
                {confirmReset ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-warn">고친 내용이 사라져요.</span>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => {
                        resetToMain();
                        setConfirmReset(false);
                      }}
                      className={`${btnSecondary} !px-2 !py-0.5 !text-xs`}
                    >
                      되돌리기
                    </button>
                    <button type="button" onClick={() => setConfirmReset(false)} className={`${btnGhost} !px-2 !py-0.5 !text-xs`}>
                      취소
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmReset(true)} className={`${btnGhost} !px-2 !py-0.5 !text-xs`}>
                    ↩ 원본으로 되돌리기
                  </button>
                )}
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
            onMount={(mounted, monaco) => {
              setEditor(mounted);
              // 에디터 안에서는 Tab이 들여쓰기라 키보드로 빠져나오기 어렵다 → Ctrl/⌘+Enter로 바로 Comit 창을 연다
              mounted.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => setModalOpen(true));
            }}
            options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 12 }, scrollBeyondLastLine: false }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line bg-surface px-4 py-3">
          {/* 협업 흐름에서 지금은 "작성" 단계라는 것과 다음 할 일을 알려준다 */}
          <div className="min-w-0 flex-1 basis-64">
            <FlowSteps flow={writingFlow(hasChanges)} compact />
            {notice && <p role="status" className="mt-1 text-xs text-warn">{notice}</p>}
          </div>
          <div className="flex items-center gap-2">
            {/* 키보드 단축키 안내 (터치 화면에서는 숨긴다) */}
            <kbd className="hidden rounded-md border border-line-strong bg-background px-1.5 py-0.5 font-sans text-[11px] text-muted md:inline">
              Ctrl/⌘ + Enter
            </kbd>
            <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
              Comit하기
            </button>
          </div>
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

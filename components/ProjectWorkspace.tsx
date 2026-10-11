"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { OnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createSubmission } from "@/app/actions/submission";
import ChangePreview from "@/components/ChangePreview";
import FlowSteps from "@/components/FlowSteps";
import InviteLink from "@/components/InviteLink";
import ModalHeader from "@/components/ModalHeader";
import Mascot from "@/components/Mascot";
import Loading from "@/components/Loading";
import OnboardingCard from "@/components/OnboardingCard";
import { byCreatedDesc, keepIfSame, mergeById, newActivityIds } from "@/lib/activity";
import { writingFlow } from "@/lib/flow";
import { startPolling } from "@/lib/polling";
import { changedLineMarks, summarizeChanges } from "@/lib/changes";
import {
  clearDraft,
  LANGUAGES,
  readDraft,
  readSubmitted,
  writeSubmitted,
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
  loading: () => <Loading text="에디터를 준비하고 있어요..." />,
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
function emptyMessage(tab: TaskTab, filter: StatusFilter, alone: boolean) {
  // 프로젝트에 나 혼자라면 리뷰할 것이 생길 수 없다 → 초대를 먼저 권한다
  if (tab === "REVIEW" && alone) return "아직 혼자예요. 초대 링크를 보내 팀원을 불러보세요. 팀원이 코드를 올리면 여기에서 리뷰할 수 있어요.";
  if (tab === "REVIEW") return "지금은 리뷰할 제출이 없어요. 팀원이 [Comit하기]로 코드를 올리면 여기에 나타나요.";
  if (tab === "MINE") {
    if (filter === "ALL") return "아직 올린 제출이 없어요. 코드를 고친 뒤 [Comit하기]를 눌러 팀원에게 보여줘 볼까요?";
    if (filter === "PENDING") return "리뷰를 기다리는 내 제출이 없어요.";
    if (filter === "MERGED") return "아직 병합된 내 제출이 없어요. 팀장이 병합하면 여기에 모여요.";
    return "다시 제출할 항목이 없어요.";
  }
  return filter === "MERGED"
    ? "아직 병합된 제출이 없어요. 팀장이 병합하면 여기에 모여요."
    : "다시 제출할 항목이 없어요. 다른 변경이 먼저 병합되면, 최신 원본을 바탕으로 다시 Comit해야 하는 제출이 여기에 표시돼요.";
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
  initialVersion: string; // 이 화면이 받은 원본(mainCode)의 버전. 폴링으로 받은 버전과 다르면 원본이 바뀐 것
  initialSubmissions: SubmissionItem[];
  initialMemberCount: number;
  inviteUrl: string | null; // 팀장에게만 전달된다 (혼자일 때 빈 상태에서 초대 버튼을 보여주는 용도)
  isLeader: boolean; // 팀장이면 첫 진입 안내를 팀장용(리뷰 → 병합 → 초대)으로 보여준다
};

export default function ProjectWorkspace({ projectId, myNickname, initialCode, initialVersion, initialSubmissions, initialMemberCount, inviteUrl, isLeader }: Props) {
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
  // "다시 얹기"로 만든 코드인지 (안내 문구가 달라진다)
  const rebased = useSyncExternalStore(
    () => () => {},
    () => readDraft(projectId, initialCode)?.rebased ?? false,
    () => false
  );
  const [staleDismissed, setStaleDismissed] = useState(false);
  // 방금 Comit한 코드 (에디터의 코드가 이것과 같으면 "이미 보낸 코드"로 보고 또 Comit하라고 하지 않는다)
  const [submitted, setSubmitted] = useState(() => (typeof window === "undefined" ? null : readSubmitted(projectId)));
  const [confirmReset, setConfirmReset] = useState(false); // "원본으로 되돌리기" 확인 단계
  // 언어 선택은 탭에 저장해 상세 페이지에 다녀와도 유지한다 (서버 렌더에서는 일반 텍스트)
  const language = useSyncExternalStore(subscribeLanguage, () => readLanguage(projectId), () => "plaintext" as Language);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  // 자동 갱신으로 새 활동(새 제출, 새 댓글)이 생긴 제출 id. 카드와 탭에 작은 점으로 표시한다
  const [unseen, setUnseen] = useState<ReadonlySet<string>>(new Set());
  // 폴링으로 확인한 최신 원본의 버전. 처음 받은 버전과 다르면 "원본이 바뀌었어요" 배너를 띄운다
  const [memberCount, setMemberCount] = useState(initialMemberCount); // 혼자인지 판단 (폴링으로 갱신)
  const alone = memberCount <= 1;
  const [latestVersion, setLatestVersion] = useState(initialVersion);
  const originalChanged = latestVersion !== initialVersion;
  // [최신 원본 보기]를 눌렀을 때만 받아 오는 최신 원본 (null이면 창이 닫힌 상태)
  const [latestMain, setLatestMain] = useState<string | null>(null);
  const [latestError, setLatestError] = useState("");
  async function showLatestMain() {
    setLatestError("");
    try {
      const res = await fetch(`/api/project/${projectId}/main`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setLatestMain(((await res.json()) as { mainCode: string }).mainCode);
    } catch {
      setLatestError(RETRY_MESSAGE);
    }
  }
  const latestSubmissions = useRef(submissions); // 폴링 콜백에서 "지금 목록"과 비교하기 위한 최신 값
  useEffect(() => {
    latestSubmissions.current = submissions;
  }, [submissions]);

  // 자동 갱신: 창에 포커스가 돌아올 때 + 15초마다 목록을 다시 가져온다 (숨은 탭에서는 멈춤)
  useEffect(() => {
    return startPolling(async () => {
      const res = await fetch(`/api/project/${projectId}/submissions`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { submissions: SubmissionItem[]; mainVersion: string; memberCount: number };
      setMemberCount(data.memberCount);
      setLatestVersion(data.mainVersion); // 원본이 바뀌었는지 알림용 (에디터의 코드는 건드리지 않는다)
      const fresh = newActivityIds(latestSubmissions.current, data.submissions, myNickname);
      if (fresh.length > 0) setUnseen((prev) => new Set([...prev, ...fresh]));
      setSubmissions((prev) => keepIfSame(prev, mergeById(prev, data.submissions).sort(byCreatedDesc))); // 바뀐 게 없으면 다시 그리지 않는다
    }, POLL_MS);
  }, [projectId, myNickname]);

  const [tab, setTab] = useState<TaskTab>("REVIEW");
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  // 탭을 바꾸면 그 탭의 기본 상태 필터로 되돌린다
  function selectTab(next: TaskTab, nextFilter: StatusFilter = TAB_FILTERS[next][0]) {
    setTab(next);
    setFilter(nextFilter);
  }
  // 좁은 화면에서는 목록을 한 줄로 접어 두고 에디터 자리를 넓힌다 (넓은 화면에서는 항상 펼침)
  const [listOpen, setListOpen] = useState(false);
  const reviewCount = submissions.filter((s) => inTab(s, "REVIEW", myNickname)).length;
  const anyUnseen = submissions.some((s) => unseen.has(s.id));
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  function handleCodeChange(value: string) {
    setCode(value);
    const keepStale = fromStale && !staleDismissed;
    writeDraft(projectId, { code: value, base: initialCode, fromStale: keepStale, rebased: keepStale && rebased });
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

  // ESC 키로 모달(제출 / 최신 원본 보기) 닫기
  const anyModalOpen = modalOpen || latestMain !== null;
  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setModalOpen(false);
      setLatestMain(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyModalOpen]);

  const visible = filterSubmissions(submissions, tab, myNickname, filter);
  const hasChanges = summary.changed > 0;
  // 브라우저 저장소 값이라 hydration이 끝난 뒤에만 반영한다
  const alreadySubmitted = hydrated && hasChanges && submitted?.code === code;

  // 에디터 단축키(Ctrl/⌘+Enter)는 처음 한 번만 등록되므로, 항상 "지금 상태"를 보도록 ref에 최신 함수를 담아 둔다
  const openComitRef = useRef(() => {});
  useEffect(() => {
    openComitRef.current = () => {
      if (!alreadySubmitted) setModalOpen(true); // 이미 보낸 코드면 창을 열지 않는다
    };
  }, [alreadySubmitted]);


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
    const sent = { code, submissionId: result.submission.id };
    setSubmitted(sent); // 이 코드는 이미 보냈다고 기억한다
    writeSubmitted(projectId, sent);
    selectTab("MINE");
    setTitle("");
    setNotice(result.notice ?? "");
    setModalOpen(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="flex max-h-56 shrink-0 flex-col border-b border-line bg-surface md:max-h-none md:w-72 md:border-r md:border-b-0">
        {/* 좁은 화면 전용: 목록 접기/펼치기 한 줄 (접혀 있어도 개수와 새 활동은 보인다) */}
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          aria-expanded={listOpen}
          aria-controls="submission-list"
          className="flex shrink-0 items-center gap-2 px-4 py-2.5 text-left text-sm md:hidden"
        >
          <span aria-hidden>📋</span>
          <span className="font-medium">제출 목록 {submissions.length}개</span>
          {reviewCount > 0 && <span className={`${badge} bg-accent-soft text-accent-ink !px-2 !py-0`}>리뷰할 것 {reviewCount}</span>}
          {anyUnseen && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-accent-ink">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />새 활동
            </span>
          )}
          <span className="ml-auto text-xs text-muted">{listOpen ? "▴ 접기" : "▾ 펼치기"}</span>
        </button>
        <div id="submission-list" className={`${listOpen ? "flex" : "hidden"} min-h-0 flex-1 flex-col border-t border-line md:flex md:border-t-0`}>
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
                className={`flex items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[13px] leading-tight transition ${
                  active ? "bg-background font-medium shadow-sm ring-1 ring-line" : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
                <span className={`${badge} ${active ? "bg-accent-soft text-accent-ink" : "bg-line text-muted"} !px-1.5 !py-0 !text-[11px]`}>{count}</span>
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
                  filter === f ? "bg-accent-soft font-medium text-accent-ink" : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>
        )}
        <ul className="flex-1 space-y-1.5 overflow-y-auto p-2">
          {visible.length === 0 && (
            <li className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong p-4 text-center text-sm leading-relaxed text-muted">
              {/* 빈 상태: 차분히 기다리는 코밋이 + 다음에 뭘 하면 되는지 */}
              <Mascot mood={alone && tab === "REVIEW" ? "hello" : "calm"} size={44} />
              {emptyMessage(tab, filter, alone)}
              {/* 혼자일 때: 다음 행동(초대)을 바로 할 수 있게 버튼을 이 자리에 둔다 (초대 링크는 팀장만 가진다) */}
              {alone && tab === "REVIEW" && inviteUrl && <InviteLink url={inviteUrl} />}
            </li>
          )}
          {visible.map((s) => (
            <li key={s.id}>
              <Link
                href={`/project/${projectId}/submission/${s.id}`}
                className="block rounded-2xl border border-transparent bg-background p-3 shadow-soft ring-1 ring-line transition hover:-translate-y-px hover:shadow-md hover:ring-line-strong"
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
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-accent-ink">
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
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* 첫 진입 안내 (닫으면 다시 나오지 않는다) */}
        <OnboardingCard
          hasChanges={hasChanges}
          hasSubmitted={submissions.some((s) => s.author === myNickname)}
          leader={isLeader ? { hasMerged: submissions.some((s) => s.status === "MERGED"), hasTeam: !alone } : undefined}
        />
        {/* 다른 변경이 병합돼 원본이 바뀌었을 때: 알려주기만 하고, 작성 중인 코드는 절대 자동으로 바꾸지 않는다 */}
        {originalChanged && (
          <div role="status" className={`${noticeWarn} m-3 mb-0 flex flex-wrap items-center gap-2`}>
            <span className="min-w-0 flex-1 basis-56 leading-relaxed">
              <strong className="font-semibold">원본이 바뀌었어요.</strong> 다른 변경이 병합됐어요. 작성 중인 코드는 그대로 두었으니, 최신 원본을
              확인하고 필요한 부분을 맞춰주세요.
            </span>
            <button type="button" onClick={showLatestMain} className={`${btnSecondary} !px-2.5 !py-1 !text-xs`}>
              최신 원본 보기
            </button>
            {latestError && <span role="alert" className="basis-full text-xs">{latestError}</span>}
          </div>
        )}
        {fromStale && !staleDismissed && (
          <div className={`${noticeWarn} m-3 flex flex-wrap items-center gap-2`}>
            <span className="flex-1">
              {rebased
                ? "최신 원본 위에 내 변경을 다시 얹었어요. 아래 코드를 확인하고, 괜찮으면 다시 Comit하세요."
                : "충돌했던 제출의 코드를 불러왔어요. 다른 사람이 먼저 바꾼 내용이 있을 수 있으니, 확인하고 고친 뒤 다시 Comit하세요."}
            </span>
            <button type="button" onClick={resetToMain} className={`${btnSecondary} !px-2.5 !py-1 !text-xs`}>
              최신 원본으로 되돌리기
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-4 py-2">
          <p className="min-w-0 flex-1 basis-64 text-xs text-muted">
            마음껏 고쳐보세요. 원본은 병합 전까지 바뀌지 않아요. (작성 중인 코드는 이 브라우저 탭에 임시 저장돼요)
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
          <label className="flex items-center gap-2 text-xs text-muted" title="언어를 고르면 코드에 색이 입혀져 읽기 쉬워져요">
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
        <div className="relative min-h-64 flex-1">
          {/* 에디터가 비어 있을 때: 빈 화면 앞에서 멈추지 않게 무엇을 하면 되는지 알려준다 (클릭은 에디터로 그대로 전달) */}
          {hydrated && code.trim() === "" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-6 pl-16">
              <div className="flex max-w-sm items-start gap-3 rounded-2xl border border-dashed border-line-strong bg-background/90 p-4 text-sm leading-relaxed">
                <Mascot mood={initialCode.trim() === "" ? "hello" : "oops"} size={36} />
                {initialCode.trim() === "" ? (
                  <p>
                    <strong className="font-semibold">아직 원본이 비어 있어요.</strong>
                    <span className="mt-0.5 block text-muted">
                      여기를 눌러 첫 코드를 적어보세요. Comit하고 팀장이 병합하면 팀 모두의 첫 원본이 돼요.
                    </span>
                  </p>
                ) : (
                  <p>
                    <strong className="font-semibold">코드를 모두 지웠어요.</strong>
                    <span className="mt-0.5 block text-muted">
                      이대로 Comit하면 원본을 전부 지우자는 제안이 돼요. 실수였다면 위의 [원본으로 되돌리기]를 눌러주세요.
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
          <Editor
            height="100%"
            language={language}
            theme={dark ? "vs-dark" : "light"}
            value={code}
            onChange={(v) => handleCodeChange(v ?? "")}
            onMount={(mounted, monaco) => {
              setEditor(mounted);
              // 에디터 안에서는 Tab이 들여쓰기라 키보드로 빠져나오기 어렵다 → Ctrl/⌘+Enter로 바로 Comit 창을 연다
              mounted.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => openComitRef.current());
            }}
            options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 12 }, scrollBeyondLastLine: false }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line bg-surface px-4 py-3">
          {/* 협업 흐름에서 지금은 "작성" 단계라는 것과 다음 할 일을 알려준다 */}
          <div className="min-w-0 flex-1 basis-64">
            <FlowSteps flow={writingFlow(hasChanges, alreadySubmitted)} compact />
            {alreadySubmitted && submitted && (
              <Link href={`/project/${projectId}/submission/${submitted.submissionId}`} className="mt-0.5 inline-block text-xs font-medium text-accent-ink underline-offset-2 hover:underline">
                방금 Comit한 제출 보러 가기 →
              </Link>
            )}
            {notice && <p role="status" className="mt-1 text-xs text-warn">{notice}</p>}
          </div>
          <div className="flex items-center gap-2">
            {/* 키보드 단축키 안내 (터치 화면에서는 숨긴다) */}
            <kbd className="hidden rounded-md border border-line-strong bg-background px-1.5 py-0.5 font-sans text-[11px] text-muted md:inline">
              Ctrl/⌘ + Enter
            </kbd>
            {/* 같은 코드를 두 번 보내지 않게: 이미 보낸 코드면 버튼을 쉬게 한다 (코드를 고치면 다시 켜진다) */}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={alreadySubmitted}
              title={alreadySubmitted ? "이미 Comit한 코드예요. 코드를 더 고치면 다시 Comit할 수 있어요." : undefined}
              className={alreadySubmitted ? btnSecondary : btnPrimary}
            >
              {alreadySubmitted ? "✓ Comit 완료" : "Comit하기"}
            </button>
          </div>
        </div>
      </section>

      {latestMain !== null && (
        <div className={modalOverlay} onClick={() => setLatestMain(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="latest-main-title"
            onClick={(e) => e.stopPropagation()}
            className={`${modalCard} flex max-h-[calc(100dvh-2rem)] !max-w-xl flex-col gap-4 overflow-y-auto`}
          >
            <ModalHeader id="latest-main-title" mood="oops" title="원본이 이렇게 바뀌었어요">
              이 화면을 열었을 때의 원본과 지금 원본의 차이예요. 내 에디터의 코드는 그대로니 걱정 마세요.
            </ModalHeader>
            <ChangePreview
              before={initialCode}
              after={latestMain}
              label="내가 보던 원본에서"
              emptyText="내용은 같아요. (다른 변경이 병합됐다가 같은 내용으로 돌아왔어요)"
            />
            <p className="rounded-xl bg-surface p-3 text-xs leading-relaxed text-muted">
              지금 그대로 Comit하면 위에 보이는 변경이 지워진 것처럼 제출될 수 있어요. 초록색 줄을 내 코드에도 옮겨 적거나, 페이지를 새로고침해 최신
              원본에서 다시 시작하세요. (새로고침하면 작성 중인 코드는 사라져요)
            </p>
            <div className="flex justify-end">
              <button type="button" autoFocus onClick={() => setLatestMain(null)} className={btnPrimary}>
                확인했어요
              </button>
            </div>
          </div>
        </div>
      )}

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
            <ModalHeader id="comit-modal-title" mood="happy" title="무엇을 바꿨나요?">
              보내기 전에 바뀐 부분을 한 번 확인하고, 팀원이 알아보기 쉽게 한 줄로 적어주세요.
            </ModalHeader>
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
                {pending ? "AI가 읽어보는 중... (최대 15초)" : error ? "다시 시도" : "제출하기"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

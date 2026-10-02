"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { createSubmission } from "@/app/actions/submission";
import { clearDraft, readDraft, writeDraft } from "@/lib/draft";
import type { SubmissionItem } from "@/lib/validation";
import { btnGhost, btnPrimary, inputClass, modalCard, modalOverlay, RETRY_MESSAGE } from "@/lib/ui";

// Monaco는 브라우저 전용이라 SSR을 끄고 불러온다
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-zinc-500">에디터 불러오는 중...</p>,
});

const TABS = [
  { status: "PENDING", label: "대기" },
  { status: "MERGED", label: "병합됨" },
  { status: "STALE", label: "충돌" },
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

  const visible = submissions.filter((s) => s.status === tab);

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
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-300 dark:border-zinc-700">
        <div className="flex border-b border-zinc-300 text-sm dark:border-zinc-700">
          {TABS.map((t) => (
            <button
              key={t.status}
              type="button"
              onClick={() => setTab(t.status)}
              className={`flex-1 px-2 py-2 ${tab === t.status ? "border-b-2 border-zinc-900 font-bold dark:border-zinc-100" : "text-zinc-500"}`}
            >
              {t.label} {submissions.filter((s) => s.status === t.status).length}
            </button>
          ))}
        </div>
        <ul className="flex-1 overflow-y-auto">
          {visible.length === 0 && (
            <li className="p-3 text-sm text-zinc-500">
              {tab === "PENDING"
                ? "아직 리뷰를 기다리는 제출이 없어요. 코드를 고친 뒤 아래 [Comit하기]를 눌러 팀원에게 보여주세요."
                : tab === "MERGED"
                  ? "아직 병합된 제출이 없어요. 팀장이 병합하면 여기에 모여요."
                  : "충돌한 제출이 없어요. 다른 사람이 먼저 병합하면 여기에 표시돼요."}
            </li>
          )}
          {visible.map((s) => (
            <li key={s.id} className="border-b border-zinc-200 dark:border-zinc-800">
              <Link href={`/project/${projectId}/submission/${s.id}`} className="block p-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
                <p className="truncate font-medium">{s.title}</p>
                <p className="text-xs text-zinc-500">
                  {s.author} · {formatTime(s.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {fromStale && !staleDismissed && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <span className="flex-1">
              충돌했던 제출의 코드를 불러왔어요. 다른 사람이 먼저 바꾼 내용이 있을 수 있으니, 확인하고 고친 뒤 다시 Comit하세요.
            </span>
            <button type="button" onClick={resetToMain} className="rounded border border-amber-400 px-2 py-1 dark:border-amber-700">
              최신 코드로 되돌리기
            </button>
          </div>
        )}
        <p className="border-b border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-700">
          코드를 자유롭게 고쳐보세요. 다 됐다면 아래 [Comit하기]로 팀원에게 리뷰를 요청해요. (작성 중인 코드는 이 브라우저 탭에 임시 저장돼요)
        </p>
        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={code}
            onChange={(v) => handleCodeChange(v ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 14 }}
          />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-zinc-300 p-3 dark:border-zinc-700">
          {notice && <p role="status" className="flex-1 text-sm text-amber-700 dark:text-amber-400">{notice}</p>}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={btnPrimary}
          >
            Comit하기
          </button>
        </div>
      </section>

      {modalOpen && (
        <div className={modalOverlay} onClick={() => setModalOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className={`${modalCard} flex flex-col gap-3`}
          >
            <h2 className="text-lg font-bold">무엇을 바꿨나요?</h2>
            <p className="text-sm text-zinc-500">팀원이 알아보기 쉽게 한 줄로 적어주세요.</p>
            <input
              autoFocus
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 로그인 버튼 추가"
              className={inputClass}
            />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className={btnGhost}>
                취소
              </button>
              <button
                type="submit"
                disabled={pending}
                className={btnPrimary}
              >
                {pending ? "AI가 코드를 분석하는 중이에요... (최대 15초)" : error ? "다시 시도" : "제출하기"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

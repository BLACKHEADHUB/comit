"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { createSubmission } from "@/app/actions/submission";
import type { SubmissionItem } from "@/lib/validation";

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
  const [code, setCode] = useState(initialCode);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [tab, setTab] = useState<(typeof TABS)[number]["status"]>("PENDING");
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const visible = submissions.filter((s) => s.status === tab);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const result = await createSubmission(projectId, title, code);
    setPending(false);

    if (result.error || !result.submission) {
      setError(result.error ?? "제출에 실패했어요.");
      return;
    }
    // 성공: 사이드바 맨 위에 추가하고 대기 탭으로 이동
    setSubmissions((prev) => [result.submission!, ...prev]);
    setTab("PENDING");
    setTitle("");
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
          {visible.length === 0 && <li className="p-3 text-sm text-zinc-500">제출이 없어요.</li>}
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
        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 14 }}
          />
        </div>
        <div className="flex justify-end border-t border-zinc-300 p-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Comit하기
          </button>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-6" onClick={() => setModalOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-white p-6 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-bold">무엇을 바꿨나요?</h2>
            <input
              autoFocus
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제출 제목"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-2 text-sm">
                취소
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {pending ? "제출 중..." : "제출"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

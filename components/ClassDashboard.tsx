"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { regenerateClassCode, unlinkClassProject, updateClassroom } from "@/app/actions/classroom";
import { MAX_PROJECTS_PER_CLASS } from "@/lib/classroom";
import {
  buildClassCsv,
  filterAndSortTeams,
  summarizeClass,
  type ClassFilter,
  type ClassSort,
  type ClassTeamSummary,
} from "@/lib/classroomDashboard";
import { copyText, showForManualCopy } from "@/lib/clipboard";
import { formatTime } from "@/lib/tags";
import { badge, btnGhost, btnPrimary, btnSecondary, card, inputClass, noticeError, noticeOk } from "@/lib/ui";

const FILTERS: { id: ClassFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "concentrated", label: "몰림 주의 (80%+)" },
  { id: "no-submissions", label: "제출 0건" },
  { id: "quiet", label: "조용한 팀원 있음" },
];

// 강사용 수업 대시보드: 반 요약, 검색·필터·정렬, 성적/평가용 CSV 내보내기, 반 코드·수업 설정·팀 연결 해제
export default function ClassDashboard({
  token,
  initialTitle,
  initialInstructor,
  initialJoinCode,
  initialTeams,
}: {
  token: string;
  initialTitle: string;
  initialInstructor: string;
  initialJoinCode: string;
  initialTeams: ClassTeamSummary[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const [instructorName, setInstructorName] = useState(initialInstructor);
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [teams, setTeams] = useState(initialTeams);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClassFilter>("all");
  const [sort, setSort] = useState<ClassSort>("title");

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [draftInstructor, setDraftInstructor] = useState(initialInstructor);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const summary = useMemo(() => summarizeClass(teams), [teams]);
  const visibleTeams = useMemo(() => filterAndSortTeams(teams, query, filter, sort), [teams, query, filter, sort]);

  const copyCode = async () => {
    if (await copyText(joinCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      showForManualCopy(joinCode);
    }
  };

  const downloadCsv = () => {
    const csv = buildClassCsv(visibleTeams);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_").trim() || "comit-class";
    a.href = url;
    a.download = `${safeTitle}-기여도.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateClassroom(token, draftTitle, draftInstructor);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setTitle(res.title ?? draftTitle);
      setInstructorName(res.instructorName ?? draftInstructor);
      setEditing(false);
      setFeedback({ type: "ok", text: "수업 정보를 저장했어요." });
    });
  };

  const handleRegenerateCode = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await regenerateClassCode(token);
      if (res.error || !res.joinCode) {
        setFeedback({ type: "error", text: res.error ?? "코드를 다시 만들지 못했어요." });
        return;
      }
      setJoinCode(res.joinCode);
      setFeedback({ type: "ok", text: "새 반 코드를 발급했어요. 이전 코드는 더 이상 쓸 수 없어요." });
    });
  };

  const handleUnlink = (projectId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await unlinkClassProject(token, projectId);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setTeams((prev) => prev.filter((t) => t.id !== projectId));
      setConfirmUnlinkId(null);
      setFeedback({ type: "ok", text: "해당 팀의 수업 연결을 해제했어요. (팀 프로젝트 자체는 유지됩니다)" });
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Comit 수업 화면 · 강사용</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
          {instructorName && <p className="text-sm text-muted">{instructorName}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setDraftTitle(title);
              setDraftInstructor(instructorName);
              setEditing((v) => !v);
            }}
          >
            {editing ? "닫기" : "수업 설정"}
          </button>
          <div className={`${card} flex items-center gap-2 px-3 py-1.5`}>
            <div>
              <p className="text-[11px] text-muted">반 코드</p>
              <p className="font-mono text-base font-semibold tracking-widest">{joinCode}</p>
            </div>
            <button type="button" className={btnGhost} onClick={copyCode}>
              {copied ? "✓ 복사됨" : "복사"}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={pending}
              onClick={handleRegenerateCode}
              title="기존 코드가 외부에 유출됐을 때 새 코드를 발급합니다"
            >
              재발급
            </button>
          </div>
        </div>
      </header>

      {editing && (
        <form onSubmit={handleSaveInfo} className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}>
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
            수업 이름
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              required
              maxLength={50}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium sm:w-48">
            강사 이름 (선택)
            <input
              value={draftInstructor}
              onChange={(e) => setDraftInstructor(e.target.value)}
              maxLength={20}
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "저장 중..." : "저장"}
          </button>
        </form>
      )}

      {feedback && (
        <p role={feedback.type === "error" ? "alert" : "status"} className={feedback.type === "error" ? noticeError : noticeOk}>
          {feedback.text}
        </p>
      )}

      <p className="rounded-xl bg-surface px-3 py-2 text-sm">
        각 팀의 팀장이 프로젝트의 <strong>📊 기여도</strong> 화면 아래에 반 코드를 넣으면 이 목록에 나타나요. 이 화면에서는 기여도 숫자만 보이고, 학생들의 코드와 댓글 내용은 보이지 않아요. 이 페이지 주소는 강사님만 보관해주세요.
      </p>

      {/* 반 전체 요약 카드 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${card} px-4 py-3`}>
          <p className="text-xs text-muted">연결된 팀</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">
            {summary.teamCount} <span className="text-xs font-normal text-muted">/ {MAX_PROJECTS_PER_CLASS}</span>
          </p>
        </div>
        <div className={`${card} px-4 py-3`}>
          <p className="text-xs text-muted">전체 반영 / 제출</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">
            {summary.totalMerged} <span className="text-sm font-normal text-muted">/ {summary.totalSubmitted}</span>
          </p>
        </div>
        <div className={`${card} px-4 py-3`}>
          <p className="text-xs text-muted">몰림 주의 (80%+)</p>
          <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${summary.concentratedCount > 0 ? "text-warn" : ""}`}>
            {summary.concentratedCount}팀
          </p>
        </div>
        <div className={`${card} px-4 py-3`}>
          <p className="text-xs text-muted">제출 0건 팀</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{summary.noSubmissionCount}팀</p>
        </div>
      </section>

      {teams.length === 0 ? (
        <p className={`${card} p-6 text-center text-sm text-muted`}>
          아직 연결된 팀이 없어요. 학생들에게 반 코드 {joinCode}를 알려주세요.
        </p>
      ) : (
        <>
          {/* 검색 · 필터 · 정렬 · CSV 내보내기 바 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`${badge} cursor-pointer transition ${
                    filter === f.id ? "bg-accent text-white" : "bg-surface text-muted ring-1 ring-line hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="팀명·팀원 검색"
                aria-label="팀명 또는 팀원 검색"
                className={`${inputClass} !w-44`}
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as ClassSort)}
                aria-label="정렬 기준"
                className={`${inputClass} !w-auto`}
              >
                <option value="title">팀명순</option>
                <option value="recent">최근 활동순</option>
                <option value="topShare">몰림 높은 순</option>
                <option value="submitted">제출 많은 순</option>
              </select>
              <button type="button" className={btnSecondary} onClick={downloadCsv} disabled={visibleTeams.length === 0}>
                CSV 내보내기
              </button>
            </div>
          </div>

          {visibleTeams.length === 0 ? (
            <p className={`${card} p-6 text-center text-sm text-muted`}>조건에 맞는 팀이 없어요.</p>
          ) : (
            <section className={`${card} overflow-x-auto`}>
              <table className="w-full min-w-[780px] whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="px-4 py-2.5 font-medium">팀 (프로젝트)</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">팀원</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">반영 / 제출</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">리뷰</th>
                    <th scope="col" className="px-2 py-2.5 font-medium" title="반영된 줄 중 가장 많이 쓴 한 사람의 비율">한 사람 몰림</th>
                    <th scope="col" className="px-2 py-2.5 font-medium">최근 2주 조용한 팀원</th>
                    <th scope="col" className="px-2 py-2.5 font-medium">마지막 활동</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTeams.map((t) => (
                    <tr key={t.id} className="border-b border-line last:border-0">
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        <Link href={`/class/${token}/project/${t.id}`} className="text-accent-ink underline-offset-2 hover:underline">
                          {t.title}
                        </Link>
                      </th>
                      <td className="px-2 py-3 text-right tabular-nums">{t.memberCount}</td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        {t.merged} / {t.submitted}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">{t.reviews}</td>
                      <td className="px-2 py-3">
                        {t.merged === 0 ? (
                          <span className="text-xs text-muted">아직 없음</span>
                        ) : (
                          // 한 사람이 80% 이상이면 눈에 띄게 (판단은 강사가 한다)
                          <span className={`${badge} ${t.topShare >= 80 && t.memberCount > 1 ? "bg-warn-soft text-warn" : "bg-surface text-muted ring-1 ring-line"}`}>
                            {t.topShare}%
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-xs">{t.quiet.length > 0 ? t.quiet.join(", ") : <span className="text-muted">없음</span>}</td>
                      <td className="px-2 py-3 text-xs text-muted">{t.lastActiveAt ? formatTime(t.lastActiveAt) : "아직 없음"}</td>
                      <td className="px-4 py-3 text-right">
                        {confirmUnlinkId === t.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => handleUnlink(t.id)}
                              className="rounded-full bg-danger px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                              해제 확인
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmUnlinkId(null)}
                              className="rounded-full px-2 py-1 text-xs text-muted hover:bg-surface"
                            >
                              취소
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmUnlinkId(t.id)}
                            className="text-xs text-muted underline-offset-2 hover:text-danger hover:underline"
                          >
                            연결 해제
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </main>
  );
}

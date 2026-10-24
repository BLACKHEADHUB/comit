import Link from "next/link";
import { notFound } from "next/navigation";
import { teamTotals } from "@/lib/contribution";
import { loadContribution } from "@/lib/contributionData";
import { findClassroomByToken } from "@/lib/classroomAuth";
import { formatTime } from "@/lib/tags";
import { badge, card } from "@/lib/ui";
import { Project } from "@/models/Project";
import { MAX_PROJECTS_PER_CLASS } from "@/lib/classroom";

// 강사용 화면은 검색엔진에 노출되지 않게 한다
export const metadata = { title: "수업 · Comit", robots: { index: false, follow: false } };

// 강사용 수업 화면: 이 반에 연결된 팀들의 기여도 요약을 한눈에 본다 (코드와 댓글 내용은 보여주지 않는다)
export default async function ClassPage({ params }: PageProps<"/class/[token]">) {
  const { token } = await params;
  const classroom = await findClassroomByToken(token);
  if (!classroom) notFound();

  // 이 수업에 연결된 프로젝트만 조회한다 (멀티테넌시 격리)
  const projects = await Project.find({ classroomId: classroom._id })
    .select({ title: 1, members: 1 })
    .sort({ title: 1 })
    .limit(MAX_PROJECTS_PER_CLASS)
    .lean();

  const now = new Date();
  const teams = await Promise.all(
    projects.map(async (p) => {
      const rows = await loadContribution(p, now);
      const totals = teamTotals(rows);
      const current = rows.filter((r) => r.role !== "LEFT");
      const last = rows.reduce<Date | null>((acc, r) => (r.lastActiveAt && (!acc || r.lastActiveAt > acc) ? r.lastActiveAt : acc), null);
      // 반영된 줄이 한 사람에게 몰렸는지 (가장 많이 한 사람의 비율)
      const topShare = Math.max(0, ...current.map((r) => r.lineShare));
      return { id: String(p._id), title: p.title, memberCount: current.length, totals, last, topShare };
    })
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Comit 수업 화면 · 강사용</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{classroom.title}</h1>
          {classroom.instructorName && <p className="text-sm text-muted">{classroom.instructorName}</p>}
        </div>
        <div className={`${card} px-4 py-2 text-center`}>
          <p className="text-xs text-muted">반 코드</p>
          <p className="font-mono text-lg font-semibold tracking-widest">{classroom.joinCode}</p>
        </div>
      </header>

      <p className="rounded-xl bg-surface px-3 py-2 text-sm">
        각 팀의 팀장이 프로젝트의 <strong>📊 기여도</strong> 화면 아래에 반 코드를 넣으면 이 목록에 나타나요. 이 화면에서는 기여도 숫자만 보이고, 학생들의 코드와 댓글 내용은 보이지 않아요. 이 페이지 주소는 강사님만 보관해주세요.
      </p>

      {teams.length === 0 ? (
        <p className={`${card} p-6 text-center text-sm text-muted`}>아직 연결된 팀이 없어요. 학생들에게 반 코드 {classroom.joinCode}를 알려주세요.</p>
      ) : (
        <section className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[720px] whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="px-4 py-2.5 font-medium">팀 (프로젝트)</th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">팀원</th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">반영 / 제출</th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">리뷰</th>
                <th scope="col" className="px-2 py-2.5 font-medium" title="반영된 줄 중 가장 많이 쓴 한 사람의 비율">한 사람 몰림</th>
                <th scope="col" className="px-2 py-2.5 font-medium">최근 2주 조용한 팀원</th>
                <th scope="col" className="px-4 py-2.5 font-medium">마지막 활동</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    <Link href={`/class/${token}/project/${t.id}`} className="text-accent-ink underline-offset-2 hover:underline">
                      {t.title}
                    </Link>
                  </th>
                  <td className="px-2 py-3 text-right tabular-nums">{t.memberCount}</td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {t.totals.merged} / {t.totals.submitted}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{t.totals.reviews}</td>
                  <td className="px-2 py-3">
                    {t.totals.merged === 0 ? (
                      <span className="text-xs text-muted">아직 없음</span>
                    ) : (
                      // 한 사람이 80% 이상이면 눈에 띄게 (판단은 강사가 한다)
                      <span className={`${badge} ${t.topShare >= 80 && t.memberCount > 1 ? "bg-warn-soft text-warn" : "bg-surface text-muted ring-1 ring-line"}`}>{t.topShare}%</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-xs">{t.totals.quiet.length > 0 ? t.totals.quiet.join(", ") : <span className="text-muted">없음</span>}</td>
                  <td className="px-4 py-3 text-xs text-muted">{t.last ? formatTime(t.last.toISOString()) : "아직 없음"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

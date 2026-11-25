import { notFound } from "next/navigation";
import ClassDashboard from "@/components/ClassDashboard";
import { MAX_PROJECTS_PER_CLASS } from "@/lib/classroom";
import { findClassroomByToken } from "@/lib/classroomAuth";
import type { ClassTeamSummary } from "@/lib/classroomDashboard";
import { teamTotals } from "@/lib/contribution";
import { loadClassContributions } from "@/lib/contributionData";
import { Project } from "@/models/Project";

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
  // 팀마다 따로 조회하지 않고 반 전체를 한 번에 조회해 N+1 쿼리를 막는다
  const contributions = await loadClassContributions(projects, now);

  const teams: ClassTeamSummary[] = projects.map((p) => {
    const rows = contributions.get(String(p._id)) ?? [];
    const totals = teamTotals(rows);
    const current = rows.filter((r) => r.role !== "LEFT");
    const last = rows.reduce<Date | null>(
      (acc, r) => (r.lastActiveAt && (!acc || r.lastActiveAt > acc) ? r.lastActiveAt : acc),
      null
    );
    // 반영된 줄이 한 사람에게 몰렸는지 (가장 많이 한 사람의 비율)
    const topShare = Math.max(0, ...current.map((r) => r.lineShare));

    return {
      id: String(p._id),
      title: p.title,
      memberCount: current.length,
      submitted: totals.submitted,
      merged: totals.merged,
      reviews: totals.reviews,
      topShare,
      quiet: totals.quiet,
      lastActiveAt: last ? last.toISOString() : null,
      rows: rows.map((r) => ({
        nickname: r.nickname,
        role: r.role,
        submitted: r.submitted,
        merged: r.merged,
        linesChanged: r.linesChanged,
        lineShare: r.lineShare,
        reviews: r.reviews,
        bugsFound: r.bugsFound,
        replies: r.replies,
        lastActiveAt: r.lastActiveAt ? r.lastActiveAt.toISOString() : null,
      })),
    };
  });

  return (
    <ClassDashboard
      token={token}
      initialTitle={classroom.title}
      initialInstructor={classroom.instructorName ?? ""}
      initialJoinCode={classroom.joinCode}
      initialAssignmentPrompt={classroom.assignmentPrompt ?? ""}
      initialStarterCode={classroom.starterCode ?? ""}
      initialTeams={teams}
      maxProjects={MAX_PROJECTS_PER_CLASS}
    />
  );
}

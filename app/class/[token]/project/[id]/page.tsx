import { notFound } from "next/navigation";
import ClassCodeViewer from "@/components/ClassCodeViewer";
import ClassFeedbackForm from "@/components/ClassFeedbackForm";
import ClassProcessTimeline from "@/components/ClassProcessTimeline";
import ContributionReport from "@/components/ContributionReport";
import { findClassProject } from "@/lib/classroomAuth";
import { loadClassTimeline, loadContribution } from "@/lib/contributionData";
import { card } from "@/lib/ui";

export const metadata = { title: "팀 기여도 · Comit", robots: { index: false, follow: false } };

// 강사가 보는 한 팀의 기여도 리포트 (이 수업에 연결된 팀만 열리며, 최종 병합된 mainCode와 과정 타임라인을 보여준다)
export default async function ClassProjectReportPage({ params }: PageProps<"/class/[token]/project/[id]">) {
  const { token, id } = await params;
  const found = await findClassProject(token, id);
  if (!found) notFound();

  const now = new Date();
  const [rows, timeline] = await Promise.all([
    loadContribution(found.project, now),
    loadClassTimeline(found.project._id),
  ]);
  const mainCode = found.project.mainCode ?? "";
  const lineCount = mainCode ? mainCode.split("\n").length : 0;

  return (
    <ContributionReport
      title={found.project.title}
      rows={rows}
      now={now}
      backHref={`/class/${token}`}
      backLabel={`${found.classroom.title} 수업으로`}
    >
      <ClassFeedbackForm
        token={token}
        projectId={id}
        initialFeedback={found.project.instructorFeedback ?? ""}
        initialFeedbackAt={found.project.instructorFeedbackAt ? found.project.instructorFeedbackAt.toISOString() : null}
      />
      <section className={`${card} flex flex-col gap-2 p-4`} aria-label="최종 병합된 코드">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">📄 최종 병합된 코드 (읽기 전용 · 실행 가능)</h2>
          <span className="text-xs text-muted">{lineCount > 0 ? `총 ${lineCount}줄` : "아직 없음"}</span>
        </div>
        <p className="text-xs text-muted">
          팀장이 병합을 승인한 최종 결과 코드만 표시돼요. 학생이 작성 중인 초안이나 리뷰 댓글 내용은 보이지 않아요.
        </p>
        <ClassCodeViewer code={mainCode} />
      </section>
      <ClassProcessTimeline items={timeline} />
    </ContributionReport>
  );
}

import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import ClassLinkForm from "@/components/ClassLinkForm";
import ClassProcessTimeline from "@/components/ClassProcessTimeline";
import ContributionReport from "@/components/ContributionReport";
import { findMember } from "@/lib/auth";
import { loadClassTimeline, loadContribution } from "@/lib/contributionData";
import { Classroom } from "@/models/Classroom";

export const metadata = { title: "팀 기여도 · Comit" };

// 팀원별 기여도 리포트: 누가 무엇을 올리고, 얼마나 반영되고, 누구 코드를 리뷰했는지 한 장으로 본다
export default async function ReportPage({ params }: PageProps<"/project/[id]/report">) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  // 이 프로젝트의 멤버만 볼 수 있다 (멀티테넌시 격리)
  const member = await findMember(id);
  if (!member) notFound();
  const { project, me } = member;

  const now = new Date();
  const [rows, timeline] = await Promise.all([
    loadContribution(project, now),
    loadClassTimeline(project._id),
  ]);

  // 연결된 수업이 있으면 이름을 보여준다 (반 코드나 강사 링크는 보여주지 않는다)
  const classroom = project.classroomId ? await Classroom.findById(project.classroomId).select({ title: 1, instructorName: 1 }).lean() : null;

  return (
    <ContributionReport title={project.title} rows={rows} now={now} backHref={`/project/${id}`} backLabel="프로젝트로 돌아가기">
      <ClassProcessTimeline items={timeline} />
      <ClassLinkForm
        projectId={id}
        isLeader={me.role === "LEADER"}
        linked={classroom ? { title: classroom.title, instructorName: classroom.instructorName } : null}
      />
    </ContributionReport>
  );
}

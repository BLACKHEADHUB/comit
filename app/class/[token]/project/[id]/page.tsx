import { notFound } from "next/navigation";
import ContributionReport from "@/components/ContributionReport";
import { findClassProject } from "@/lib/classroomAuth";
import { loadContribution } from "@/lib/contributionData";

export const metadata = { title: "팀 기여도 · Comit", robots: { index: false, follow: false } };

// 강사가 보는 한 팀의 기여도 리포트 (이 수업에 연결된 팀만 열린다)
export default async function ClassProjectReportPage({ params }: PageProps<"/class/[token]/project/[id]">) {
  const { token, id } = await params;
  const found = await findClassProject(token, id);
  if (!found) notFound();

  const now = new Date();
  const rows = await loadContribution(found.project, now);
  return <ContributionReport title={found.project.title} rows={rows} now={now} backHref={`/class/${token}`} backLabel={`${found.classroom.title} 수업으로`} />;
}

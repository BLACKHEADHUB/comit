import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { findMember } from "@/lib/auth";
import { buildInviteUrl } from "@/lib/invite";
import ProjectWorkspace from "@/components/ProjectWorkspace";
import type { SubmissionItem } from "@/lib/validation";
import { Submission } from "@/models/Submission";

// Vercel에서 [Comit하기](Server Action)가 AI 분석을 기다리는 동안 함수가 끊기지 않도록 최대 실행 시간을 늘린다
export const maxDuration = 30;

// 프로젝트 메인 화면: 제출 목록 + 에디터
export default async function ProjectPage({ params }: PageProps<"/project/[id]">) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  // 이 프로젝트의 멤버만 접근 허용 (멀티테넌시 격리)
  const member = await findMember(id);
  if (!member) notFound();
  const { project, me } = member;

  // 초대 링크는 팀장에게만 보여준다
  let inviteUrl: string | null = null;
  if (me.role === "LEADER") inviteUrl = await buildInviteUrl(project.inviteToken);

  // 항상 projectId로 필터링하고, 목록에는 코드 본문을 싣지 않는다
  const docs = await Submission.find({ projectId: id })
    .select("title author status createdAt")
    .sort({ createdAt: -1 })
    .lean();
  const submissions: SubmissionItem[] = docs.map((d) => ({
    id: String(d._id),
    title: d.title,
    author: d.author,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <main className="flex h-screen w-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
        <h1 className="font-bold">{project.title}</h1>
        <span className="text-zinc-500">
          {me.nickname} ({me.role === "LEADER" ? "팀장" : "팀원"}) · 멤버 {project.members.length}명
        </span>
        {inviteUrl && (
          <span className="min-w-0 truncate text-zinc-500">
            초대 링크: <code>{inviteUrl}</code>
          </span>
        )}
      </header>
      <ProjectWorkspace projectId={id} initialCode={project.mainCode} initialSubmissions={submissions} />
    </main>
  );
}

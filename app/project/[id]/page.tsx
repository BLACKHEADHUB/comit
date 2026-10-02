import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { buildInviteUrl } from "@/lib/invite";
import { getMemberId } from "@/lib/session";
import ProjectWorkspace from "@/components/ProjectWorkspace";
import type { SubmissionItem } from "@/lib/validation";
import { Project } from "@/models/Project";
import { Submission } from "@/models/Submission";

// 임시 프로젝트 화면: 쿠키로 "나"를 식별하는지 확인하는 용도 (에디터는 다음 단계)
export default async function ProjectPage({ params }: PageProps<"/project/[id]">) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectDB();
  const project = await Project.findById(id).lean();
  if (!project) notFound();

  // 쿠키의 멤버 _id가 이 프로젝트의 멤버일 때만 접근 허용 (멀티테넌시 격리)
  const memberId = await getMemberId(id);
  const me = project.members.find((m) => String(m._id) === memberId);
  if (!me) notFound();

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

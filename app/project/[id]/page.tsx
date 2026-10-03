import { isValidObjectId } from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findMember } from "@/lib/auth";
import { buildInviteUrl } from "@/lib/invite";
import InviteLink from "@/components/InviteLink";
import ProjectWorkspace from "@/components/ProjectWorkspace";
import { badge } from "@/lib/ui";
import { listSubmissions } from "@/lib/submissions";

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

  // 항상 projectId로 필터링하고, 목록에는 코드 본문을 싣지 않는다 (댓글 수 등 배지용 집계도 같은 쿼리에서 계산)
  const submissions = await listSubmissions(project._id);

  return (
    <main className="flex h-dvh w-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
        <Link href="/" className="text-base font-bold tracking-tight transition hover:opacity-70">
          Comit<span className="text-accent">.</span>
        </Link>
        <span className="hidden h-4 w-px bg-line-strong sm:block" />
        <h1 className="min-w-0 truncate text-sm font-semibold">{project.title}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className={`${badge} ${me.role === "LEADER" ? "bg-accent-soft text-accent" : "bg-surface text-muted ring-1 ring-line"}`}>
            {me.role === "LEADER" ? "👑 팀장" : "팀원"} · {me.nickname}
          </span>
          <span>멤버 {project.members.length}명</span>
          {inviteUrl && <InviteLink url={inviteUrl} />}
        </div>
      </header>
      <ProjectWorkspace projectId={id} initialCode={project.mainCode} initialSubmissions={submissions} />
    </main>
  );
}

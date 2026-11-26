import { isValidObjectId } from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findMember } from "@/lib/auth";
import { getNewCodeCookie } from "@/lib/session";
import ClassLinkButton from "@/components/ClassLinkButton";
import RecoveryNotice from "@/components/RecoveryNotice";
import { buildInviteUrl } from "@/lib/invite";
import InviteLink from "@/components/InviteLink";
import MemberAvatars from "@/components/MemberAvatars";
import ProjectWorkspace from "@/components/ProjectWorkspace";
import TermsHelp from "@/components/TermsHelp";
import { Classroom } from "@/models/Classroom";
import { badge, noticeWarn } from "@/lib/ui";
import { orderMembers } from "@/lib/members";
import { listSubmissions } from "@/lib/submissions";
import { daysUntilExpiry, shouldWarnExpiry } from "@/lib/retention";
import { codeVersion } from "@/lib/version";
import { onlineNicknames } from "@/lib/presence";
import { touchPresence } from "@/lib/presenceServer";

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

  // 연결된 수업이 있으면 메인 헤더에서도 바로 상태를 확인하고 연결/해제할 수 있게 조회한다
  const classroom = project.classroomId
    ? await Classroom.findById(project.classroomId).select({ title: 1, instructorName: 1, assignmentPrompt: 1 }).lean()
    : null;

  // 방금 합류했다면 복구 코드를 한 번 보여준다
  const newRecoveryCode = await getNewCodeCookie(id);

  // 항상 projectId로 필터링하고, 목록에는 코드 본문을 싣지 않는다 (댓글 수 등 배지용 집계도 같은 쿼리에서 계산)
  const submissions = await listSubmissions(project._id);

  // 오래 안 쓰면 정리된다는 안내 (만료 30일 전부터). 제출·댓글을 하면 기간이 새로 시작된다
  const daysLeft = daysUntilExpiry(project.lastActivityAt, project.createdAt);

  // 접속 중 표시: 들어온 순간 내 접속 시각을 적고, 지금 접속 중인 팀원을 처음 화면에 넘긴다
  await touchPresence(project._id, me._id);
  const initialOnline = onlineNicknames(project.members, new Date(), me.nickname);

  return (
    <main className="flex h-dvh w-full flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-background px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" className="text-base font-bold tracking-tight transition hover:opacity-70">
            Comit<span className="text-accent-ink">.</span>
          </Link>
          <span className="h-4 w-px bg-line-strong" />
          <h1 className="max-w-44 truncate text-sm font-semibold sm:max-w-xs">{project.title}</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span className={`${badge} ${me.role === "LEADER" ? "bg-accent-soft text-accent-ink" : "bg-surface text-muted ring-1 ring-line"}`}>
            {me.role === "LEADER" ? "👑 팀장" : "팀원"} · {me.nickname}
          </span>
          {/* 누가 함께하는지: 이니셜 아바타 묶음 (팀장 → 나 → 나머지 순) */}
          <MemberAvatars members={orderMembers(project.members, me.nickname)} projectId={id} projectTitle={project.title} isLeader={me.role === "LEADER"} />
          {inviteUrl && <InviteLink url={inviteUrl} />}
          <ClassLinkButton
            projectId={id}
            isLeader={me.role === "LEADER"}
            linked={
              classroom
                ? {
                    title: classroom.title,
                    instructorName: classroom.instructorName,
                    assignmentPrompt: classroom.assignmentPrompt ?? "",
                  }
                : null
            }
          />
          {/* 팀원별 기여도 리포트 (팀플 발표·평가 자료로 인쇄할 수 있다) */}
          <Link href={`/project/${id}/report`} className="rounded-full px-2.5 py-1 transition hover:bg-surface hover:text-foreground">
            📊 기여도
          </Link>
          {/* 원본, Comit, 병합 같은 낯선 말을 바로 확인할 수 있게 */}
          <TermsHelp openFirstVisit />
        </div>
      </header>
      {shouldWarnExpiry(daysLeft) && (
        <p role="status" className={`${noticeWarn} mx-4 mt-2 !py-1.5 !text-xs`}>
          오래 사용하지 않아 {Math.max(daysLeft, 0)}일 뒤 이 프로젝트가 정리돼요. 제출하거나 댓글을 남기면 기간이 다시 시작되고, 멤버 메뉴에서 원본 코드를 내려받을 수 있어요.
        </p>
      )}
      {newRecoveryCode && <RecoveryNotice projectId={id} code={newRecoveryCode} />}
      <ProjectWorkspace
        projectId={id} myNickname={me.nickname} initialCode={project.mainCode} initialVersion={codeVersion(project.mainCode)} initialSubmissions={submissions}
        initialMemberCount={project.members.length}
        initialOnline={initialOnline}
        inviteUrl={inviteUrl}
        isLeader={me.role === "LEADER"}
        assignmentPrompt={classroom?.assignmentPrompt ?? ""}
        instructorFeedback={project.instructorFeedback ?? ""}
        instructorFeedbackAt={project.instructorFeedbackAt ? project.instructorFeedbackAt.toISOString() : null}
      />
    </main>
  );
}

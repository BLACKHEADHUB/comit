import { notFound, redirect } from "next/navigation";
import CenteredCard from "@/components/CenteredCard";
import NicknameForm from "@/components/NicknameForm";
import { joinProject } from "@/app/actions/project";
import { connectDB } from "@/lib/db";
import { getMemberId } from "@/lib/session";
import { Project } from "@/models/Project";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;

  await connectDB();
  const project = await Project.findOne({ inviteToken: token }).lean();
  if (!project) notFound();

  // 이미 합류한 브라우저라면 닉네임을 다시 묻지 않고 바로 이동
  const memberId = await getMemberId(String(project._id));
  if (memberId && project.members.some((m) => String(m._id) === memberId)) {
    redirect(`/project/${project._id}`);
  }

  return (
    <CenteredCard
      title={`${project.title}에 초대받았어요`}
      description={`현재 멤버 ${project.members.length}명 · 닉네임을 정하고 합류하세요.`}
    >
      <NicknameForm action={joinProject} submitLabel="합류하기" token={token} />
    </CenteredCard>
  );
}

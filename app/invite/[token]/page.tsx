import { notFound, redirect } from "next/navigation";
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
    redirect(`/p/${project._id}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">초대받았어요! 닉네임을 정하고 합류하세요.</p>
      </div>
      <NicknameForm action={joinProject} submitLabel="합류하기" token={token} />
    </main>
  );
}

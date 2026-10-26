import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CenteredCard from "@/components/CenteredCard";
import NicknameForm from "@/components/NicknameForm";
import { joinProject } from "@/app/actions/project";
import { connectDB } from "@/lib/db";
import { getMemberId } from "@/lib/session";
import { btnPrimary, noticeWarn } from "@/lib/ui";
import { Project } from "@/models/Project";

// 메신저에 초대 링크를 붙이면 "OO 프로젝트에 초대받았어요" 미리보기가 뜨게 한다 (검색 노출은 여전히 막는다)
export async function generateMetadata({ params }: PageProps<"/invite/[token]">): Promise<Metadata> {
  const { token } = await params;
  await connectDB();
  const project = await Project.findOne({ inviteToken: token }).select("title").lean();
  if (!project) return { title: "Comit (코밋)" };
  const title = `${project.title}에 초대받았어요 · Comit`;
  const description = "닉네임만 정하면 바로 합류해요. 설치도 회원가입도 필요 없어요.";
  return { title, description, openGraph: { title, description, siteName: "Comit", type: "website" } };
}

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;

  await connectDB();
  const project = await Project.findOne({ inviteToken: token }).lean();
  if (!project) notFound();

  // 이 브라우저가 이미 이 프로젝트의 멤버라면, 말없이 넘기지 않고 선택지를 보여준다
  // (그냥 들어가기 / 다른 닉네임으로 새로 합류하기: 한 컴퓨터로 팀원 역할을 테스트할 때도 필요하다)
  const memberId = await getMemberId(String(project._id));
  const me = memberId ? project.members.find((m) => String(m._id) === memberId) : undefined;
  if (me) {
    return (
      <CenteredCard
        title={`${project.title}에 이미 들어와 있어요`}
        description={`이 브라우저에서는 지금 ${me.nickname}(${me.role === "LEADER" ? "팀장" : "팀원"})님으로 들어와 있어요.`}
      >
        <div className="flex flex-col gap-4">
          <Link href={`/project/${project._id}`} className={btnPrimary}>
            {me.nickname}님으로 계속하기
          </Link>
          <details className="rounded-2xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">다른 닉네임으로 새로 합류하기</summary>
            <div className="mt-3 flex flex-col gap-3">
              <p className={noticeWarn}>
                새로 합류하면 이 브라우저는 새 멤버로 바뀌어요. {me.nickname}님으로 다시 돌아오려면 복구 코드가 필요해요.
              </p>
              <NicknameForm action={joinProject} submitLabel="새 멤버로 합류하기" token={token} />
            </div>
          </details>
        </div>
      </CenteredCard>
    );
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

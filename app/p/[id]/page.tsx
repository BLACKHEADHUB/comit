import { isValidObjectId } from "mongoose";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getMemberId } from "@/lib/session";
import { Project } from "@/models/Project";

// 임시 프로젝트 화면: 쿠키로 "나"를 식별하는지 확인하는 용도 (에디터는 다음 단계)
export default async function ProjectPage({ params }: PageProps<"/p/[id]">) {
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
  if (me.role === "LEADER") {
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    inviteUrl = `${proto}://${host}/invite/${project.inviteToken}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        {project.description && <p className="mt-1 text-sm text-zinc-500">{project.description}</p>}
      </div>
      <p className="text-sm">
        내 정보: <b>{me.nickname}</b> ({me.role === "LEADER" ? "팀장" : "팀원"})
      </p>
      {inviteUrl && (
        <div className="rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700">
          <p className="mb-1 font-medium">초대 링크</p>
          <code className="break-all">{inviteUrl}</code>
        </div>
      )}
      <div>
        <p className="mb-1 text-sm font-medium">멤버 ({project.members.length})</p>
        <ul className="text-sm">
          {project.members.map((m) => (
            <li key={String(m._id)}>
              {m.nickname} · {m.role === "LEADER" ? "팀장" : "팀원"}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

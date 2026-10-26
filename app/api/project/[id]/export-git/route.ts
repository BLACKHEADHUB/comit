import { findMember } from "@/lib/auth";
import { buildGitRepo, fileNameFor, githubGuide, zipFiles } from "@/lib/gitExport";
import { Submission } from "@/models/Submission";

const FOLDER = "comit-project";

// 병합 기록을 Git 저장소(zip)로 내려받는다. GitHub에 그대로 올릴 수 있다
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 이 프로젝트의 멤버만 내려받을 수 있다 (멀티테넌시 격리)
  const member = await findMember(id);
  if (!member) return new Response("not found", { status: 404 });

  // 파일 확장자를 정하려고 에디터 언어만 받는다 (모르는 값이면 .txt)
  const fileName = fileNameFor(new URL(req.url).searchParams.get("lang"));
  const merged = await Submission.find({ projectId: member.project._id, status: "MERGED" })
    .select({ title: 1, author: 1, beforeCode: 1, afterCode: 1, createdAt: 1 })
    .lean();

  const { files: repo, commitCount } = buildGitRepo(
    merged.map((s) => ({ title: s.title, author: s.author, beforeCode: s.beforeCode ?? "", afterCode: s.afterCode ?? "", createdAt: s.createdAt })),
    member.project.mainCode,
    fileName
  );
  const files = new Map<string, Buffer>([["GitHub에_올리는_법.md", Buffer.from(githubGuide(FOLDER, fileName, commitCount))]]);
  for (const [path, data] of repo) files.set(`${FOLDER}/${path}`, data);

  return new Response(new Uint8Array(zipFiles(files)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="comit-git.zip"',
      "Cache-Control": "no-store",
    },
  });
}

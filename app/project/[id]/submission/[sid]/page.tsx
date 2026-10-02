import { isValidObjectId } from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getMemberId } from "@/lib/session";
import MergePanel from "@/components/MergePanel";
import SubmissionDiff from "@/components/SubmissionDiff";
import type { CommentItem } from "@/lib/validation";
import { Comment } from "@/models/Comment";
import { Project } from "@/models/Project";
import { Submission } from "@/models/Submission";

export default async function SubmissionPage({
  params,
}: PageProps<"/project/[id]/submission/[sid]">) {
  const { id, sid } = await params;
  if (!isValidObjectId(id) || !isValidObjectId(sid)) notFound();

  await connectDB();

  // 쿠키의 멤버 _id가 이 프로젝트의 멤버일 때만 접근 허용 (멀티테넌시 격리)
  const memberId = await getMemberId(id);
  const project = memberId
    ? await Project.findOne({ _id: id, "members._id": memberId }).select("members mainCode").lean()
    : null;
  const me = project?.members.find((m) => String(m._id) === memberId);
  if (!project || !me) notFound();

  // projectId까지 함께 걸어서 다른 프로젝트의 제출은 조회되지 않게 한다
  const submission = await Submission.findOne({ _id: sid, projectId: id }).lean();
  if (!submission) notFound();

  // 위에서 projectId로 검증한 제출의 댓글만 조회한다
  const commentDocs = await Comment.find({ submissionId: submission._id }).sort({ createdAt: 1 }).lean();
  const comments: CommentItem[] = commentDocs.map((c) => ({
    id: String(c._id),
    author: c.author,
    lineNumber: c.lineNumber,
    tag: c.tag,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
  }));

  const { summary, warning, concept } = submission.aiReport ?? { summary: [], warning: "", concept: "" };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6">
      <Link href={`/project/${id}`} className="text-sm text-zinc-500 hover:underline">
        ← 프로젝트로 돌아가기
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{submission.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{submission.author}</p>
      </div>

      {/* 병합은 팀장만 (버튼 표시 + 서버에서 다시 검증) */}
      <MergePanel
        projectId={id}
        submissionId={sid}
        initialStatus={submission.status}
        canMerge={me.role === "LEADER"}
        afterCode={submission.afterCode}
        latestMainCode={project.mainCode}
      />

      {/* AI 분석 카드 */}
      <section className="flex flex-col gap-4 rounded-xl border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-bold">🤖 AI 분석</h2>
        <div>
          <h3 className="mb-1 text-sm font-medium">3줄 요약</h3>
          {summary.length > 0 ? (
            <ol className="list-decimal pl-5 text-sm">
              {summary.slice(0, 3).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-500">분석 결과가 없어요.</p>
          )}
        </div>
        {warning && (
          <div role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            <b>⚠️ 주의</b> {warning}
          </div>
        )}
        {concept && (
          <div>
            <h3 className="mb-1 text-sm font-medium">핵심 개념</h3>
            <p className="text-sm">{concept}</p>
          </div>
        )}
      </section>

      {/* 코드는 실행하지 않고 텍스트로만 비교한다 */}
      <SubmissionDiff
        projectId={id}
        submissionId={sid}
        beforeCode={submission.beforeCode}
        afterCode={submission.afterCode}
        initialComments={comments}
      />
    </main>
  );
}

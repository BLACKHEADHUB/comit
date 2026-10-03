import { isValidObjectId } from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findMember } from "@/lib/auth";
import MergePanel from "@/components/MergePanel";
import { ReviewProvider } from "@/components/ReviewProvider";
import SubmissionDiff from "@/components/SubmissionDiff";
import SubmissionFlow from "@/components/SubmissionFlow";
import { card, noticeError } from "@/lib/ui";
import { listComments } from "@/lib/review";
import { Submission } from "@/models/Submission";

export default async function SubmissionPage({
  params,
}: PageProps<"/project/[id]/submission/[sid]">) {
  const { id, sid } = await params;
  if (!isValidObjectId(id) || !isValidObjectId(sid)) notFound();

  // 이 프로젝트의 멤버만 접근 허용 (멀티테넌시 격리)
  const member = await findMember(id);
  if (!member) notFound();
  const { project, me } = member;

  // projectId까지 함께 걸어서 다른 프로젝트의 제출은 조회되지 않게 한다
  const submission = await Submission.findOne({ _id: sid, projectId: id }).lean();
  if (!submission) notFound();

  // 위에서 projectId로 검증한 제출의 댓글만 조회한다
  const comments = await listComments(submission._id);

  const { summary, warning, concept } = submission.aiReport ?? { summary: [], warning: "", concept: "" };

  return (
    <ReviewProvider
      projectId={id}
      submissionId={sid}
      viewer={{ nickname: me.nickname, isLeader: me.role === "LEADER", submissionAuthor: submission.author }}
      initialComments={comments}
      initialStatus={submission.status}
    >
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <Link href={`/project/${id}`} className="w-fit text-sm text-muted transition hover:text-foreground">
        ← 프로젝트로 돌아가기
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{submission.title}</h1>
          <p className="mt-1 text-sm text-muted">{submission.author}님의 제출</p>
        </div>
        {/* 병합은 팀장만 (버튼 표시 + 서버에서 다시 검증) */}
        <MergePanel
          projectId={id}
          submissionId={sid}
          canMerge={me.role === "LEADER"}
          beforeCode={submission.beforeCode}
          afterCode={submission.afterCode}
          latestMainCode={project.mainCode}
        />
      </div>

      {/* 지금 어느 단계인지 + 다음 할 일 */}
      <SubmissionFlow isAuthor={submission.author === me.nickname} isLeader={me.role === "LEADER"} />

      {/* AI 분석 카드 */}
      <section className={`${card} overflow-hidden`}>
        {/* 머리 부분은 라벤더 톤 (파스텔 위에는 회색 글자를 쓰지 않고 같은 계열의 진한 색을 쓴다) */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-line bg-lavender-soft px-5 py-3">
          <span aria-hidden>🤖</span>
          <h2 className="text-sm font-semibold">AI가 먼저 읽어봤어요</h2>
          <span className="text-xs text-lavender">참고용이에요. 최종 판단은 팀원이 함께 해주세요.</span>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[2fr_1fr]">
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">3줄 요약</h3>
            {summary.length > 0 ? (
              <ol className="space-y-2">
                {summary.slice(0, 3).map((line, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">
                      {i + 1}
                    </span>
                    {line}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">아직 분석 결과가 없어요.</p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {warning && (
              <div role="alert" className={noticeError}>
                <p className="mb-0.5 font-semibold">⚠️ 주의</p>
                <p className="leading-relaxed">{warning}</p>
              </div>
            )}
            {concept && (
              <div className="rounded-xl bg-peach-soft p-3">
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-peach">💡 오늘의 개념</h3>
                <p className="text-sm leading-relaxed">{concept}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 코드는 실행하지 않고 텍스트로만 비교한다 */}
      <SubmissionDiff
        projectId={id}
        submissionId={sid}
        beforeCode={submission.beforeCode}
        afterCode={submission.afterCode}
      />
    </main>
    </ReviewProvider>
  );
}

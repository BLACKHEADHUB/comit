import "server-only";
import type { Types } from "mongoose";
import { buildContribution, type ContributionRow } from "@/lib/contribution";
import { Comment } from "@/models/Comment";
import { Submission } from "@/models/Submission";

// 기여도 리포트에 필요한 기록을 DB에서 모아 계산한다.
// 호출하는 쪽에서 권한 확인(팀 멤버 또는 연결된 반의 강사)을 마친 프로젝트만 넘겨야 한다
export async function loadContribution(
  project: { _id: Types.ObjectId; members: { nickname: string; role: "LEADER" | "MEMBER" }[] },
  now = new Date()
): Promise<ContributionRow[]> {
  // 항상 projectId로 거른 제출만, 그 제출에 달린 댓글만 가져온다 (멀티테넌시 격리)
  const submissions = await Submission.find({ projectId: project._id })
    .select({ author: 1, status: 1, beforeCode: 1, afterCode: 1, createdAt: 1 })
    .lean();
  const authorOf = new Map(submissions.map((s) => [String(s._id), s.author]));
  const comments = await Comment.find({ submissionId: { $in: submissions.map((s) => s._id) } })
    .select({ submissionId: 1, author: 1, parentId: 1, tag: 1, resolved: 1, createdAt: 1 })
    .lean();

  return buildContribution(
    project.members,
    submissions.map((s) => ({ author: s.author, status: s.status, beforeCode: s.beforeCode ?? "", afterCode: s.afterCode ?? "", createdAt: s.createdAt })),
    comments.map((c) => ({
      author: c.author,
      submissionAuthor: authorOf.get(String(c.submissionId)) ?? "",
      isReply: Boolean(c.parentId),
      tag: c.tag,
      resolved: Boolean(c.resolved),
      createdAt: c.createdAt,
    })),
    now
  );
}

// 강사용 반 화면 N+1 방지: 반에 연결된 모든 팀의 제출·댓글을 각각 1번씩만 조회해 팀별로 묶어 계산한다
export async function loadClassContributions(
  projects: { _id: Types.ObjectId; members: { nickname: string; role: "LEADER" | "MEMBER" }[] }[],
  now = new Date()
): Promise<Map<string, ContributionRow[]>> {
  const result = new Map<string, ContributionRow[]>();
  if (projects.length === 0) return result;

  const projectIds = projects.map((p) => p._id);
  const submissions = await Submission.find({ projectId: { $in: projectIds } })
    .select({ projectId: 1, author: 1, status: 1, beforeCode: 1, afterCode: 1, createdAt: 1 })
    .lean();

  const subsByProject = new Map<string, typeof submissions>();
  const subMeta = new Map<string, { projectId: string; author: string }>();
  for (const s of submissions) {
    const pid = String(s.projectId);
    const list = subsByProject.get(pid);
    if (list) list.push(s);
    else subsByProject.set(pid, [s]);
    subMeta.set(String(s._id), { projectId: pid, author: s.author });
  }

  const comments = submissions.length > 0
    ? await Comment.find({ submissionId: { $in: submissions.map((s) => s._id) } })
        .select({ submissionId: 1, author: 1, parentId: 1, tag: 1, resolved: 1, createdAt: 1 })
        .lean()
    : [];

  const commentsByProject = new Map<string, { author: string; submissionAuthor: string; isReply: boolean; tag?: string | null; resolved?: boolean; createdAt: Date }[]>();
  for (const c of comments) {
    const meta = subMeta.get(String(c.submissionId));
    if (!meta) continue;
    const mapped = {
      author: c.author,
      submissionAuthor: meta.author,
      isReply: Boolean(c.parentId),
      tag: c.tag,
      resolved: Boolean(c.resolved),
      createdAt: c.createdAt,
    };
    const list = commentsByProject.get(meta.projectId);
    if (list) list.push(mapped);
    else commentsByProject.set(meta.projectId, [mapped]);
  }

  for (const project of projects) {
    const pid = String(project._id);
    const projectSubs = (subsByProject.get(pid) ?? []).map((s) => ({
      author: s.author,
      status: s.status,
      beforeCode: s.beforeCode ?? "",
      afterCode: s.afterCode ?? "",
      createdAt: s.createdAt,
    }));
    result.set(pid, buildContribution(project.members, projectSubs, commentsByProject.get(pid) ?? [], now));
  }

  return result;
}

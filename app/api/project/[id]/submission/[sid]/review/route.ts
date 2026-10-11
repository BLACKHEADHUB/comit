import { isValidObjectId } from "mongoose";
import { findMember } from "@/lib/auth";
import { listComments } from "@/lib/review";
import { Submission } from "@/models/Submission";

// 자동 갱신용: 제출 하나의 상태와 댓글을 다시 가져온다 (읽기 전용)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const notFound = () => Response.json({ error: "not found" }, { status: 404 });
  if (!isValidObjectId(sid)) return notFound();

  // 이 프로젝트의 멤버만 조회 가능 (멀티테넌시 격리)
  const member = await findMember(id);
  if (!member) return notFound();

  // projectId까지 함께 걸어서 다른 프로젝트의 제출은 조회되지 않게 한다
  const submission = await Submission.findOne({ _id: sid, projectId: member.project._id }).select("status").lean();
  if (!submission) return notFound();

  const comments = await listComments(submission._id);
  return Response.json({ status: submission.status, comments }, { headers: { "Cache-Control": "no-store" } });
}

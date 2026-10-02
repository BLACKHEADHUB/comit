import "server-only";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getMemberId } from "@/lib/session";
import { Project } from "@/models/Project";

// 현재 사용자가 이 프로젝트의 멤버인지 확인하고, 맞으면 프로젝트와 "나"를 돌려준다.
// 모든 페이지/Server Action이 이 함수 하나로 권한을 확인한다 (멀티테넌시 격리).
// projectId나 쿠키 값이 이상하면 에러 대신 null을 돌려준다.
export async function findMember(projectId: string) {
  if (!isValidObjectId(projectId)) return null;
  const memberId = await getMemberId(projectId);
  if (!memberId || !isValidObjectId(memberId)) return null;

  await connectDB();
  const project = await Project.findOne({ _id: projectId, "members._id": memberId }).lean();
  const me = project?.members.find((m) => String(m._id) === memberId);
  return project && me ? { project, me } : null;
}

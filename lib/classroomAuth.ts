import "server-only";
import { isValidObjectId } from "mongoose";
import { hashOwnerToken, isOwnerTokenShape } from "@/lib/classroom";
import { connectDB } from "@/lib/db";
import { Classroom } from "@/models/Classroom";
import { Project } from "@/models/Project";

// 강사용 링크의 토큰으로 수업을 찾는다. 모양이 틀리거나 없으면 null
export async function findClassroomByToken(token: string) {
  if (!isOwnerTokenShape(token)) return null;
  await connectDB();
  // 강사가 볼 때마다 활동 시각을 새로 적는다 (오래 안 본 수업만 정리 대상이 된다)
  return Classroom.findOneAndUpdate({ ownerTokenHash: hashOwnerToken(token) }, { $set: { lastActivityAt: new Date() } }, { returnDocument: "after" }).lean();
}

// 강사가 볼 수 있는 프로젝트인지: 이 수업에 연결된 프로젝트만 (멀티테넌시 격리)
export async function findClassProject(token: string, projectId: string) {
  if (!isValidObjectId(projectId)) return null;
  const classroom = await findClassroomByToken(token);
  if (!classroom) return null;
  const project = await Project.findOne({ _id: projectId, classroomId: classroom._id }).select({ title: 1, members: 1, mainCode: 1 }).lean();
  return project ? { classroom, project } : null;
}

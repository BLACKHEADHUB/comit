"use server";

import { isValidObjectId } from "mongoose";
import { analyzeSubmission } from "@/lib/ai";
import { connectDB } from "@/lib/db";
import { getMemberId } from "@/lib/session";
import { createSubmissionSchema, type SubmissionResult } from "@/lib/validation";
import { Project } from "@/models/Project";
import { Submission } from "@/models/Submission";

// [Comit하기]: 현재 mainCode를 beforeCode로 고정해 Submission을 만든다
export async function createSubmission(
  projectId: string,
  title: string,
  afterCode: string
): Promise<SubmissionResult> {
  if (!isValidObjectId(projectId)) return { error: "잘못된 프로젝트예요." };

  const parsed = createSubmissionSchema.safeParse({ title, afterCode });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await connectDB();

  // 쿠키의 멤버 _id가 이 프로젝트의 멤버일 때만 허용 (멀티테넌시 격리)
  const memberId = await getMemberId(projectId);
  const project = await Project.findOne({ _id: projectId, "members._id": memberId }).lean();
  const me = project?.members.find((m) => String(m._id) === memberId);
  if (!project || !me) return { error: "이 프로젝트의 멤버만 제출할 수 있어요." };

  if (parsed.data.afterCode === project.mainCode) {
    return { error: "변경된 내용이 없어요. 코드를 수정한 뒤 제출해주세요." };
  }

  // beforeCode는 클라이언트 값이 아니라 서버가 조회한 최신 mainCode, 작성자도 DB의 닉네임을 쓴다
  const submission = await Submission.create({
    projectId: project._id,
    author: me.nickname,
    title: parsed.data.title,
    beforeCode: project.mainCode,
    afterCode: parsed.data.afterCode,
    status: "PENDING",
  });

  // 제출은 이미 저장됐으므로, AI가 실패해도(fallback 반환) 흐름은 계속된다
  const aiReport = await analyzeSubmission(project.mainCode, parsed.data.afterCode);
  await Submission.updateOne({ _id: submission._id, projectId: project._id }, { aiReport });

  return {
    submission: {
      id: String(submission._id),
      title: submission.title,
      author: submission.author,
      status: submission.status,
      createdAt: submission.createdAt.toISOString(),
    },
  };
}

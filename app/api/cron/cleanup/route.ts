import { timingSafeEqual } from "node:crypto";
import { connectDB } from "@/lib/db";
import { expiryCutoff } from "@/lib/retention";
import { Classroom } from "@/models/Classroom";
import { Comment } from "@/models/Comment";
import { Project } from "@/models/Project";
import { Submission } from "@/models/Submission";

const BATCH = 50; // 한 번에 정리할 프로젝트 수 (함수 실행 시간을 넘기지 않게)

// 오래 안 쓴 프로젝트 정리 (Vercel Cron이 하루 한 번 호출)
// 안전장치: CRON_SECRET이 맞아야 하고, CLEANUP_ENABLED=true가 아니면 지우지 않고 대상만 로그로 남긴다
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const cutoff = expiryCutoff();
  // 활동 기록이 없는 옛 프로젝트는 만든 시각을 기준으로 한다
  const targets = await Project.find({
    $or: [{ lastActivityAt: { $lt: cutoff } }, { lastActivityAt: { $exists: false }, createdAt: { $lt: cutoff } }],
  })
    .select("_id")
    .limit(BATCH)
    .lean();

  // 강사가 오래 열어보지 않은 수업도 같은 기준으로 정리한다
  const classes = await Classroom.find({ lastActivityAt: { $lt: cutoff } }).select("_id").limit(BATCH).lean();

  if (process.env.CLEANUP_ENABLED !== "true") {
    console.log(`[cleanup] 미리보기: 정리 대상 프로젝트 ${targets.length}개, 수업 ${classes.length}개 (CLEANUP_ENABLED=true일 때만 실제로 지웁니다)`);
    return Response.json({ dryRun: true, count: targets.length, classes: classes.length });
  }

  for (const { _id } of classes) {
    // 수업을 지우기 전에 연결된 프로젝트의 연결만 끊는다 (프로젝트는 그대로 둔다)
    await Project.updateMany({ classroomId: _id }, { $set: { classroomId: null } });
    await Classroom.deleteOne({ _id });
  }

  for (const { _id } of targets) {
    const ids = (await Submission.find({ projectId: _id }).select("_id").lean()).map((s) => s._id);
    await Comment.deleteMany({ submissionId: { $in: ids } });
    await Submission.deleteMany({ projectId: _id });
    await Project.deleteOne({ _id });
  }
  console.log(`[cleanup] 프로젝트 ${targets.length}개, 수업 ${classes.length}개를 정리했어요.`);
  return Response.json({ dryRun: false, count: targets.length, classes: classes.length });
}

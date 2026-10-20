import "server-only";
import type { Types } from "mongoose";
import { Project } from "@/models/Project";

// 프로젝트에 활동이 있었다고 기록한다 (제출·병합·댓글). 실패해도 본래 흐름은 막지 않는다
export async function touchProject(projectId: Types.ObjectId | string): Promise<void> {
  try {
    await Project.updateOne({ _id: projectId }, { $set: { lastActivityAt: new Date() } });
  } catch (error) {
    console.error("[activity] 마지막 활동 기록 실패", error instanceof Error ? error.message.slice(0, 200) : "unknown");
  }
}

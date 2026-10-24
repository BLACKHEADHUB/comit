import "server-only";
import type { Types } from "mongoose";
import { PRESENCE_WRITE_INTERVAL_MS } from "@/lib/presence";
import { Project } from "@/models/Project";

// 내 마지막 접속 시각을 적는다. 1분 안에 이미 적었으면 아무것도 하지 않는다 (DB 쓰기를 줄이려고 조건부로 갱신)
// 실패해도 화면 흐름에는 영향이 없게 조용히 넘어간다
export async function touchPresence(projectId: Types.ObjectId, memberId: Types.ObjectId, now = new Date()): Promise<void> {
  try {
    await Project.updateOne(
      {
        _id: projectId,
        members: {
          $elemMatch: {
            _id: memberId,
            $or: [{ lastSeenAt: { $exists: false } }, { lastSeenAt: { $lt: new Date(now.getTime() - PRESENCE_WRITE_INTERVAL_MS) } }],
          },
        },
      },
      { $set: { "members.$.lastSeenAt": now } }
    );
  } catch (error) {
    console.error("[presence] 기록 실패", error instanceof Error ? error.message.slice(0, 200) : "unknown");
  }
}

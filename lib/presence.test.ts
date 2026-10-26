import { describe, expect, it } from "vitest";
import { ONLINE_WINDOW_MS, onlineNicknames } from "@/lib/presence";

const now = new Date("2026-10-24T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("onlineNicknames", () => {
  it("2분 안에 본 사람만 접속 중, 나는 항상 접속 중", () => {
    const members = [
      { nickname: "팀장", lastSeenAt: ago(30_000) },
      { nickname: "민수", lastSeenAt: ago(ONLINE_WINDOW_MS + 1) },
      { nickname: "지수" }, // 기록 없음
      { nickname: "나", lastSeenAt: null },
    ];
    expect(onlineNicknames(members, now, "나")).toEqual(["팀장", "나"]);
  });
});

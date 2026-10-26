import { describe, expect, it } from "vitest";
import { buildContribution, teamTotals, weekIndex, type ContributionComment, type ContributionSubmission } from "@/lib/contribution";

const now = new Date("2026-10-24T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

const members = [
  { nickname: "팀장", role: "LEADER" as const },
  { nickname: "민수", role: "MEMBER" as const },
  { nickname: "지수", role: "MEMBER" as const },
];

const sub = (author: string, status: ContributionSubmission["status"], before: string, after: string, ago = 1): ContributionSubmission => ({
  author, status, beforeCode: before, afterCode: after, createdAt: daysAgo(ago),
});
const comment = (author: string, submissionAuthor: string, extra: Partial<ContributionComment> = {}): ContributionComment => ({
  author, submissionAuthor, isReply: false, tag: "LIKE", createdAt: daysAgo(1), ...extra,
});

describe("weekIndex", () => {
  it("최근 7일은 마지막 칸, 범위 밖은 -1", () => {
    expect(weekIndex(daysAgo(0), now)).toBe(7);
    expect(weekIndex(daysAgo(8), now)).toBe(6);
    expect(weekIndex(daysAgo(55), now)).toBe(0);
    expect(weekIndex(daysAgo(57), now)).toBe(-1);
  });

  it("살짝 미래 시각은 이번 주로 본다", () => {
    expect(weekIndex(new Date(now.getTime() + 1000), now)).toBe(7);
  });
});

describe("buildContribution", () => {
  it("활동이 없는 멤버도 표에 나오고, 팀장이 맨 위", () => {
    const rows = buildContribution(members, [], [], now);
    expect(rows.map((r) => r.nickname)).toEqual(["팀장", "민수", "지수"]);
    expect(rows[2]).toMatchObject({ submitted: 0, merged: 0, lineShare: 0, lastActiveAt: null });
  });

  it("병합된 제출만 바뀐 줄로 세고, 비율을 계산한다", () => {
    const rows = buildContribution(
      members,
      [
        sub("민수", "MERGED", "a\n", "a\nb\nc\n"), // 2줄 추가
        sub("지수", "MERGED", "a\n", "x\n"), // 1줄 수정
        sub("지수", "PENDING", "a\n", "a\n1\n2\n3\n4\n"), // 아직 반영 전이라 줄 수에 안 들어간다
      ],
      [],
      now
    );
    const by = Object.fromEntries(rows.map((r) => [r.nickname, r]));
    expect(by["민수"]).toMatchObject({ submitted: 1, merged: 1, linesChanged: 2, lineShare: 67 });
    expect(by["지수"]).toMatchObject({ submitted: 2, merged: 1, linesChanged: 1, lineShare: 33 });
  });

  it("남의 제출에 단 원댓글만 리뷰로 세고, 답글은 따로 센다", () => {
    const rows = buildContribution(
      members,
      [],
      [
        comment("민수", "지수", { tag: "BUG" }),
        comment("민수", "지수"),
        comment("민수", "민수"), // 내 제출에 단 댓글: 리뷰 아님
        comment("지수", "지수", { isReply: true, tag: null }),
      ],
      now
    );
    const by = Object.fromEntries(rows.map((r) => [r.nickname, r]));
    expect(by["민수"]).toMatchObject({ reviews: 2, bugsFound: 1, replies: 0 });
    expect(by["지수"]).toMatchObject({ reviews: 0, replies: 1 });
    expect(by["민수"].weekly[7]).toBe(3); // 활동 자체는 모두 이번 주 칸에 들어간다
  });

  it("나간 팀원의 기록은 맨 아래에 LEFT로 남는다", () => {
    const rows = buildContribution(members, [sub("철수", "MERGED", "", "a\n")], [], now);
    expect(rows.at(-1)).toMatchObject({ nickname: "철수", role: "LEFT", merged: 1 });
  });

  it("마지막 활동 시각은 가장 최근 것", () => {
    const rows = buildContribution(members, [sub("민수", "PENDING", "", "a", 10)], [comment("민수", "지수")], now);
    expect(rows.find((r) => r.nickname === "민수")?.lastActiveAt).toEqual(daysAgo(1));
  });
});

describe("teamTotals", () => {
  it("합계와 최근 2주 조용한 멤버를 알려준다 (나간 팀원 제외)", () => {
    const rows = buildContribution(
      members,
      [sub("민수", "MERGED", "", "a", 1), sub("지수", "PENDING", "", "b", 20), sub("철수", "PENDING", "", "c", 30)],
      [comment("팀장", "민수")],
      now
    );
    expect(teamTotals(rows)).toEqual({ submitted: 3, merged: 1, reviews: 1, quiet: ["지수"] });
  });
});

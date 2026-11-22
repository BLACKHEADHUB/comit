import { describe, expect, it } from "vitest";
import {
  buildClassCsv,
  escapeCsvCell,
  filterAndSortTeams,
  summarizeClass,
  type ClassTeamSummary,
} from "./classroomDashboard";

const sampleTeams: ClassTeamSummary[] = [
  {
    id: "1",
    title: "알파팀",
    memberCount: 3,
    submitted: 10,
    merged: 6,
    reviews: 8,
    topShare: 85,
    quiet: ["민수"],
    lastActiveAt: "2026-11-20T10:00:00.000Z",
    rows: [
      {
        nickname: "영희",
        role: "LEADER",
        submitted: 7,
        merged: 5,
        linesChanged: 85,
        lineShare: 85,
        reviews: 5,
        bugsFound: 1,
        replies: 2,
        lastActiveAt: "2026-11-20T10:00:00.000Z",
      },
      {
        nickname: "민수",
        role: "MEMBER",
        submitted: 3,
        merged: 1,
        linesChanged: 15,
        lineShare: 15,
        reviews: 3,
        bugsFound: 0,
        replies: 0,
        lastActiveAt: "2026-11-01T10:00:00.000Z",
      },
    ],
  },
  {
    id: "2",
    title: "베타팀",
    memberCount: 2,
    submitted: 0,
    merged: 0,
    reviews: 0,
    topShare: 0,
    quiet: ["철수", "지영"],
    lastActiveAt: null,
    rows: [],
  },
  {
    id: "3",
    title: "감마팀",
    memberCount: 2,
    submitted: 4,
    merged: 4,
    reviews: 6,
    topShare: 55,
    quiet: [],
    lastActiveAt: "2026-11-21T12:00:00.000Z",
    rows: [],
  },
];

describe("summarizeClass", () => {
  it("반 전체 요약 통계를 계산한다", () => {
    expect(summarizeClass(sampleTeams)).toEqual({
      teamCount: 3,
      totalSubmitted: 14,
      totalMerged: 10,
      concentratedCount: 1,
      noSubmissionCount: 1,
    });
  });
});

describe("filterAndSortTeams", () => {
  it("팀명과 팀원 닉네임으로 검색한다", () => {
    expect(filterAndSortTeams(sampleTeams, "민수", "all", "title").map((t) => t.id)).toEqual(["1"]);
    expect(filterAndSortTeams(sampleTeams, "베타", "all", "title").map((t) => t.id)).toEqual(["2"]);
  });

  it("상태 필터와 정렬을 적용한다", () => {
    expect(filterAndSortTeams(sampleTeams, "", "concentrated", "title").map((t) => t.id)).toEqual(["1"]);
    expect(filterAndSortTeams(sampleTeams, "", "no-submissions", "title").map((t) => t.id)).toEqual(["2"]);
    expect(filterAndSortTeams(sampleTeams, "", "quiet", "title").map((t) => t.id)).toEqual(["2", "1"]);
    expect(filterAndSortTeams(sampleTeams, "", "all", "recent").map((t) => t.id)).toEqual(["3", "1", "2"]);
    expect(filterAndSortTeams(sampleTeams, "", "all", "topShare").map((t) => t.id)).toEqual(["1", "3", "2"]);
    expect(filterAndSortTeams(sampleTeams, "", "all", "submitted").map((t) => t.id)).toEqual(["1", "3", "2"]);
  });
});

describe("CSV 내보내기", () => {
  it("수식 인젝션 문자를 무력화하고 쉼표/따옴표를 이스케이프한다", () => {
    expect(escapeCsvCell("=CMD()")).toBe("'=CMD()");
    expect(escapeCsvCell("+1+1")).toBe("'+1+1");
    expect(escapeCsvCell('a, "b"')).toBe('"a, ""b"""');
  });

  it("UTF-8 BOM과 팀원별 행을 생성한다", () => {
    const csv = buildClassCsv(sampleTeams.slice(0, 2));
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("팀(프로젝트),팀원,역할");
    expect(csv).toContain("알파팀,영희,팀장,7,5,85,85,5,1,2,2026-11-20T10:00:00.000Z");
    expect(csv).toContain("베타팀,없음,없음,0,0,0,0,0,0,0,없음");
  });
});

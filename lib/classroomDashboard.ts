import type { ContributionRow } from "@/lib/contribution";

// 강사 대시보드에서 한 팀(프로젝트)을 요약해 보여줄 때 쓰는 데이터 모양
export type ClassTeamSummary = {
  id: string;
  title: string;
  memberCount: number;
  submitted: number;
  merged: number;
  reviews: number;
  topShare: number;
  quiet: string[];
  lastActiveAt: string | null; // ISO 문자열 (Server → Client 직렬화용)
  rows: {
    nickname: string;
    role: ContributionRow["role"];
    submitted: number;
    merged: number;
    linesChanged: number;
    lineShare: number;
    reviews: number;
    bugsFound: number;
    replies: number;
    lastActiveAt: string | null;
  }[];
};

export type ClassFilter = "all" | "concentrated" | "no-submissions" | "quiet";
export type ClassSort = "title" | "recent" | "topShare" | "submitted";

// 반 전체 상단 요약 숫자 계산
export function summarizeClass(teams: ClassTeamSummary[]) {
  return {
    teamCount: teams.length,
    totalSubmitted: teams.reduce((sum, t) => sum + t.submitted, 0),
    totalMerged: teams.reduce((sum, t) => sum + t.merged, 0),
    // 반영된 제출이 있고 2명 이상일 때 한 사람이 80% 이상을 차지한 팀 수
    concentratedCount: teams.filter((t) => t.merged > 0 && t.memberCount > 1 && t.topShare >= 80).length,
    // 아직 제출이 0건인 팀 수
    noSubmissionCount: teams.filter((t) => t.submitted === 0).length,
  };
}

// 검색어 + 상태 필터 + 정렬을 순수 함수로 적용한다
export function filterAndSortTeams(
  teams: ClassTeamSummary[],
  query: string,
  filter: ClassFilter,
  sort: ClassSort
): ClassTeamSummary[] {
  const q = query.trim().toLowerCase();

  const filtered = teams.filter((t) => {
    if (q) {
      const titleMatch = t.title.toLowerCase().includes(q);
      const memberMatch = t.rows.some((r) => r.nickname.toLowerCase().includes(q));
      if (!titleMatch && !memberMatch) return false;
    }

    if (filter === "concentrated") return t.merged > 0 && t.memberCount > 1 && t.topShare >= 80;
    if (filter === "no-submissions") return t.submitted === 0;
    if (filter === "quiet") return t.quiet.length > 0;
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (sort === "recent") {
      const ta = a.lastActiveAt ? Date.parse(a.lastActiveAt) : 0;
      const tb = b.lastActiveAt ? Date.parse(b.lastActiveAt) : 0;
      return tb - ta || a.title.localeCompare(b.title, "ko");
    }
    if (sort === "topShare") {
      return b.topShare - a.topShare || a.title.localeCompare(b.title, "ko");
    }
    if (sort === "submitted") {
      return b.submitted - a.submitted || a.title.localeCompare(b.title, "ko");
    }
    return a.title.localeCompare(b.title, "ko");
  });
}

// 엑셀/스프레드시트 수식 인젝션(=, +, -, @, 탭, 줄바꿈 시작)을 막기 위해 앞에 작은따옴표를 붙인다
export function escapeCsvCell(raw: string | number): string {
  const str = String(raw);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

const ROLE_TEXT: Record<ContributionRow["role"], string> = {
  LEADER: "팀장",
  MEMBER: "팀원",
  LEFT: "나간 팀원",
};

// 성적·평가용 CSV 문자열 생성 (UTF-8 BOM 포함으로 엑셀에서 한글이 깨지지 않는다)
export function buildClassCsv(teams: ClassTeamSummary[]): string {
  const header = [
    "팀(프로젝트)",
    "팀원",
    "역할",
    "올린 제출",
    "원본 반영",
    "반영된 줄",
    "줄 비율(%)",
    "리뷰 댓글",
    "버그 발견",
    "답글",
    "마지막 활동(ISO)",
  ];
  const lines = [header.map(escapeCsvCell).join(",")];

  for (const team of teams) {
    if (team.rows.length === 0) {
      lines.push([team.title, "없음", "없음", 0, 0, 0, 0, 0, 0, 0, "없음"].map(escapeCsvCell).join(","));
      continue;
    }
    for (const row of team.rows) {
      lines.push(
        [
          team.title,
          row.nickname,
          ROLE_TEXT[row.role],
          row.submitted,
          row.merged,
          row.linesChanged,
          row.lineShare,
          row.reviews,
          row.bugsFound,
          row.replies,
          row.lastActiveAt ?? "없음",
        ]
          .map(escapeCsvCell)
          .join(",")
      );
    }
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

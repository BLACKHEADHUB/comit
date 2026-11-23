import { summarizeChanges } from "@/lib/changes";

// 팀원별 기여도 리포트 계산 (DB를 모르는 순수 함수라 테스트하기 쉽다)
// 숫자는 "누가 무엇을 했는지" 보여주는 참고 자료일 뿐, 실력이나 성실함의 점수가 아니다.

export type ContributionSubmission = {
  author: string;
  status: "PENDING" | "MERGED" | "STALE";
  beforeCode: string;
  afterCode: string;
  createdAt: Date;
};

export type ContributionComment = {
  author: string;
  submissionAuthor: string; // 댓글이 달린 제출을 올린 사람 (자기 제출에 단 댓글은 리뷰로 세지 않는다)
  isReply: boolean;
  tag?: string | null;
  resolved?: boolean;
  createdAt: Date;
};

export type ContributionRow = {
  nickname: string;
  role: "LEADER" | "MEMBER" | "LEFT"; // LEFT = 지금은 멤버가 아니지만 기록이 남은 사람
  submitted: number; // 올린 제출 수
  merged: number; // 그중 원본에 반영된 수
  staleCount: number; // 충돌/재제출(STALE) 과정을 겪은 제출 수
  linesChanged: number; // 반영된 제출에서 바뀐 줄 수 (한 줄 수정 = 1)
  lineShare: number; // 팀 전체 반영 줄 중 내 몫 (0~100, 반올림)
  reviews: number; // 팀원 제출에 남긴 리뷰 댓글 (답글 제외)
  questions: number; // 그중 ❓ 질문 태그 (함께 질문하며 배운 횟수)
  bugsFound: number; // 그중 🐞 버그 태그
  bugsResolved: number; // 🐞 버그 태그 중 해결 완료된 수
  replies: number; // 남긴 답글
  weekly: number[]; // 최근 주별 활동 수 (제출 + 댓글). 마지막 칸이 이번 주
  lastActiveAt: Date | null;
};

export const REPORT_WEEKS = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// now 기준으로 몇 주 전인지 (0 = 최근 7일). 범위 밖이면 -1
export function weekIndex(date: Date, now: Date, weeks = REPORT_WEEKS): number {
  const ago = Math.floor((now.getTime() - date.getTime()) / WEEK_MS);
  if (ago < 0) return weeks - 1; // 시계 차이로 살짝 미래면 이번 주로 본다
  return ago < weeks ? weeks - 1 - ago : -1;
}

export function buildContribution(
  members: { nickname: string; role: "LEADER" | "MEMBER" }[],
  submissions: ContributionSubmission[],
  comments: ContributionComment[],
  now: Date = new Date()
): ContributionRow[] {
  const rows = new Map<string, ContributionRow>();
  const rowOf = (nickname: string) => {
    let row = rows.get(nickname);
    if (!row) {
      // 멤버 목록에 없는 이름 = 나간(내보내진) 팀원. 기록은 그대로 보여준다
      row = {
        nickname, role: "LEFT", submitted: 0, merged: 0, staleCount: 0, linesChanged: 0, lineShare: 0,
        reviews: 0, questions: 0, bugsFound: 0, bugsResolved: 0, replies: 0, weekly: Array(REPORT_WEEKS).fill(0), lastActiveAt: null,
      };
      rows.set(nickname, row);
    }
    return row;
  };
  const touch = (row: ContributionRow, at: Date) => {
    const w = weekIndex(at, now);
    if (w >= 0) row.weekly[w] += 1;
    if (!row.lastActiveAt || at > row.lastActiveAt) row.lastActiveAt = at;
  };

  // 지금 멤버는 활동이 없어도 표에 나와야 한다 (팀장 → 들어온 순서)
  for (const m of members) rowOf(m.nickname).role = m.role;

  for (const s of submissions) {
    const row = rowOf(s.author);
    row.submitted += 1;
    if (s.status === "MERGED") {
      row.merged += 1;
      row.linesChanged += summarizeChanges(s.beforeCode, s.afterCode).changed;
    } else if (s.status === "STALE") {
      row.staleCount += 1;
    }
    touch(row, s.createdAt);
  }

  for (const c of comments) {
    const row = rowOf(c.author);
    if (c.isReply) row.replies += 1;
    else if (c.author !== c.submissionAuthor) {
      row.reviews += 1;
      if (c.tag === "QUESTION") row.questions += 1;
      if (c.tag === "BUG") {
        row.bugsFound += 1;
        if (c.resolved) row.bugsResolved += 1;
      }
    }
    touch(row, c.createdAt);
  }

  const totalLines = [...rows.values()].reduce((sum, r) => sum + r.linesChanged, 0);
  for (const row of rows.values()) {
    row.lineShare = totalLines > 0 ? Math.round((row.linesChanged / totalLines) * 100) : 0;
  }

  // 보여주는 순서: 팀장 → 팀원(들어온 순서) → 나간 팀원
  const rank = { LEADER: 0, MEMBER: 1, LEFT: 2 } as const;
  return [...rows.values()].sort((a, b) => rank[a.role] - rank[b.role]);
}

// 리포트 위쪽 요약 숫자
export function teamTotals(rows: ContributionRow[]) {
  return {
    submitted: rows.reduce((n, r) => n + r.submitted, 0),
    merged: rows.reduce((n, r) => n + r.merged, 0),
    reviews: rows.reduce((n, r) => n + r.reviews, 0),
    // 최근 2주 동안 제출도 댓글도 없는 지금 멤버 (조용한 팀원에게 먼저 말을 걸어보라는 안내용)
    quiet: rows.filter((r) => r.role !== "LEFT" && r.weekly.slice(-2).every((n) => n === 0)).map((r) => r.nickname),
  };
}

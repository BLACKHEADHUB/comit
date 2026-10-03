import { describe, expect, it } from "vitest";
import { submissionFlow, writingFlow } from "@/lib/flow";

const states = (flow: { steps: { state: string }[] }) => flow.steps.map((s) => s.state);
const base = { commentCount: 0, isAuthor: false, isLeader: false };

describe("writingFlow", () => {
  it("항상 '작성' 단계이고, 변경 여부에 따라 안내가 달라진다", () => {
    expect(states(writingFlow(false))).toEqual(["current", "todo", "todo", "todo"]);
    expect(writingFlow(false).next).toContain("고쳐보세요");
    expect(writingFlow(true).next).toContain("Comit하기");
  });
});

describe("writingFlow: 방금 Comit한 코드 그대로일 때", () => {
  it("'제안함' 단계로 넘어가고, 또 Comit하라고 하지 않는다", () => {
    const flow = writingFlow(true, true);
    expect(states(flow)).toEqual(["done", "current", "todo", "todo"]);
    expect(flow.next).toContain("방금 Comit했어요");
    expect(flow.next).not.toContain("[Comit하기]를 눌러");
    expect(flow.tone).toBe("ok");
  });

  it("코드를 다시 고치면(더 이상 같지 않으면) 원래 안내로 돌아온다", () => {
    expect(writingFlow(true, false).next).toContain("[Comit하기]");
  });
});

describe("submissionFlow", () => {
  it("대기 + 댓글 없음 → '제안함' 단계", () => {
    const flow = submissionFlow({ ...base, status: "PENDING" });
    expect(states(flow)).toEqual(["done", "current", "todo", "todo"]);
    expect(flow.tone).toBe("normal");
  });

  it("대기 + 댓글 있음 → '리뷰 중' 단계", () => {
    expect(states(submissionFlow({ ...base, status: "PENDING", commentCount: 2 }))).toEqual(["done", "done", "current", "todo"]);
  });

  it("병합됨 → 모든 단계 완료", () => {
    const flow = submissionFlow({ ...base, status: "MERGED", commentCount: 1 });
    expect(states(flow)).toEqual(["done", "done", "done", "done"]);
    expect(flow.tone).toBe("ok");
  });

  it("STALE → 마지막 단계가 막힘으로 표시되고, 작성자에게 다시 Comit 안내", () => {
    const mine = submissionFlow({ ...base, status: "STALE", isAuthor: true });
    expect(states(mine)).toEqual(["done", "done", "done", "blocked"]);
    expect(mine.steps[3].label).toBe("원본이 먼저 바뀜");
    expect(mine.tone).toBe("warn");
    expect(mine.next).toBe("원본이 먼저 바뀌었어요 → 최신 코드로 다시 Comit해주세요.");

    const others = submissionFlow({ ...base, status: "STALE" });
    expect(others.next).toContain("작성자가");
  });

  it("역할에 따라 다음 할 일이 다르다", () => {
    const pending = { status: "PENDING" as const, commentCount: 0 };
    expect(submissionFlow({ ...pending, isAuthor: true, isLeader: false }).next).toContain("기다리는 중");
    expect(submissionFlow({ ...pending, isAuthor: false, isLeader: false }).next).toContain("첫 리뷰");
    expect(submissionFlow({ ...pending, isAuthor: false, isLeader: true }).next).toContain("병합");
    expect(submissionFlow({ ...pending, isAuthor: true, isLeader: true }).next).toContain("병합");

    const reviewing = { status: "PENDING" as const, commentCount: 3 };
    expect(submissionFlow({ ...reviewing, isAuthor: false, isLeader: true }).next).toContain("[병합하기]");
    expect(submissionFlow({ ...reviewing, isAuthor: true, isLeader: false }).next).toContain("댓글을 확인");
    // 팀원에게는 병합을 시키지 않는다
    expect(submissionFlow({ ...reviewing, isAuthor: false, isLeader: false }).next).toContain("팀장이");
  });

  it("단계는 항상 4개이고 current는 최대 1개", () => {
    for (const status of ["PENDING", "MERGED", "STALE"] as const) {
      for (const commentCount of [0, 1]) {
        const flow = submissionFlow({ ...base, status, commentCount });
        expect(flow.steps).toHaveLength(4);
        expect(states(flow).filter((s) => s === "current").length).toBeLessThanOrEqual(1);
      }
    }
  });
});

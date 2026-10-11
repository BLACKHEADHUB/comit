import type { SubmissionStatus } from "@/lib/validation";

// 협업 흐름 4단계: 작성 → 제안함 → 리뷰 중 → 반영됨
export type StepState = "done" | "current" | "todo" | "blocked";
export type FlowStep = { label: string; state: StepState };
export type Flow = {
  steps: FlowStep[];
  next: string; // "다음 할 일" 한 문장
  tone: "normal" | "ok" | "warn";
};

const LABELS = ["작성", "제안함", "리뷰 중", "반영됨"] as const;

// current번째 단계까지 진행된 모양을 만든다 (앞은 done, 뒤는 todo)
function stepsAt(current: number): FlowStep[] {
  return LABELS.map((label, i) => ({ label, state: i < current ? "done" : i === current ? "current" : "todo" }));
}

// 에디터 화면. alreadySubmitted: 지금 에디터의 코드가 방금 Comit한 코드와 똑같은지
export function writingFlow(hasChanges: boolean, alreadySubmitted = false): Flow {
  if (alreadySubmitted) {
    // 이미 보낸 코드다 → "제안함" 단계. 또 Comit하라고 하지 않는다
    return {
      steps: stepsAt(1),
      next: "방금 Comit했어요! 팀원의 리뷰를 기다리는 동안 쉬어도 되고, 더 고칠 곳이 있으면 이어서 고쳐도 돼요.",
      tone: "ok",
    };
  }
  return {
    steps: stepsAt(0),
    next: hasChanges
      ? "다 고쳤다면 [Comit하기]를 눌러 팀원에게 보여주세요."
      : "먼저 에디터에서 코드를 고쳐보세요. 원본은 병합 전까지 바뀌지 않으니 안심하고 고쳐도 돼요.",
    tone: "normal",
  };
}

type SubmissionFlowInput = {
  status: SubmissionStatus;
  commentCount: number;
  isAuthor: boolean; // 내가 올린 제출인지
  isLeader: boolean; // 병합 권한이 있는지
};

// 제출 상세 화면: 상태와 내 역할에 따라 현재 단계와 다음 할 일을 정한다
export function submissionFlow({ status, commentCount, isAuthor, isLeader }: SubmissionFlowInput): Flow {
  if (status === "MERGED") {
    return {
      steps: LABELS.map((label) => ({ label, state: "done" })),
      next: "원본에 반영됐어요. 이제 이 코드가 팀 모두의 최신 원본이에요.",
      tone: "ok",
    };
  }

  if (status === "STALE") {
    // 마지막 단계에서 막힘: 다른 변경이 먼저 병합되어 이 제출은 그대로 반영할 수 없다
    return {
      steps: [
        { label: "작성", state: "done" },
        { label: "제안함", state: "done" },
        { label: "리뷰 중", state: "done" },
        { label: "원본이 먼저 바뀜", state: "blocked" },
      ],
      next: isAuthor
        ? "원본이 먼저 바뀌었어요 → 최신 원본을 바탕으로 다시 Comit해주세요."
        : "원본이 먼저 바뀌어서 이대로는 반영할 수 없어요. 작성자가 최신 원본을 바탕으로 다시 Comit해야 해요.",
      tone: "warn",
    };
  }

  // PENDING: 댓글이 하나라도 달리면 "리뷰 중"으로 본다
  if (commentCount === 0) {
    let next = "바뀐 코드를 읽어보고, 줄 옆의 + 를 눌러 첫 리뷰를 남겨보세요.";
    if (isAuthor && isLeader) next = "팀원의 리뷰를 기다리는 중이에요. 확인이 끝났다면 병합할 수 있어요.";
    else if (isAuthor) next = "팀원의 리뷰를 기다리는 중이에요. 댓글이 달리면 여기에서 확인할 수 있어요.";
    else if (isLeader) next = "바뀐 코드를 읽어보고 리뷰를 남기거나, 괜찮다면 병합하세요.";
    return { steps: stepsAt(1), next, tone: "normal" };
  }

  let next = "다른 의견이 있다면 댓글을 더 남겨보세요. 병합은 팀장이 해요.";
  if (isLeader) next = "리뷰를 확인하고, 괜찮다면 [병합하기]로 원본에 반영하세요.";
  else if (isAuthor) next = "달린 댓글을 확인해보세요. 고칠 게 있으면 에디터에서 고쳐 다시 Comit하면 돼요.";
  return { steps: stepsAt(2), next, tone: "normal" };
}

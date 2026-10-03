import { diffLines } from "diff";

// 원본(mainCode)과 지금 코드를 줄 단위로 비교한 요약
export type ChangeSummary = {
  added: number; // 새로 생긴 줄 수
  removed: number; // 사라진 줄 수
  changed: number; // "원본에서 N줄 바뀜"에 쓰는 수. 한 줄을 고치면 (삭제 1 + 추가 1이 아니라) 1로 센다
};

export function summarizeChanges(before: string, after: string): ChangeSummary {
  let added = 0;
  let removed = 0;
  let changed = 0;
  // 붙어 있는 삭제/추가 묶음을 "한 번의 수정"으로 보고, 둘 중 큰 쪽만큼 바뀐 것으로 센다
  let blockAdded = 0;
  let blockRemoved = 0;
  const closeBlock = () => {
    changed += Math.max(blockAdded, blockRemoved);
    blockAdded = 0;
    blockRemoved = 0;
  };

  for (const part of diffLines(before, after)) {
    const count = part.count ?? 0;
    if (part.added) {
      added += count;
      blockAdded += count;
    } else if (part.removed) {
      removed += count;
      blockRemoved += count;
    } else {
      closeBlock(); // 안 바뀐 줄을 만나면 묶음이 끝난다
    }
  }
  closeBlock();

  return { added, removed, changed };
}

// 에디터 줄 번호 옆에 표시할 위치 (모두 "지금 코드" 기준 1부터 시작하는 줄 번호)
export type LineMarks = {
  added: number[]; // 새로 생긴 줄
  modified: number[]; // 원본의 줄을 고친 줄
  deletedAt: number[]; // 바로 위에서 원본의 줄이 지워진 줄
};

export function changedLineMarks(before: string, after: string): LineMarks {
  const marks: LineMarks = { added: [], modified: [], deletedAt: [] };
  const lastLine = after.split("\n").length;
  let line = 1; // 지금 코드에서 다음에 올 줄 번호
  let pendingRemoved = 0; // 직전에 지워진 원본 줄 수 (바로 뒤에 추가가 오면 "수정"으로 본다)

  // 지워지기만 하고 대신 들어온 줄이 없으면, 그 자리(다음 줄)에 삭제 표시를 남긴다
  const flushRemoved = () => {
    if (pendingRemoved > 0) marks.deletedAt.push(Math.min(line, lastLine));
    pendingRemoved = 0;
  };

  for (const part of diffLines(before, after)) {
    const count = part.count ?? 0;
    if (part.removed) {
      pendingRemoved += count;
    } else if (part.added) {
      for (let i = 0; i < count; i++) {
        // 지워진 줄 수만큼은 "수정", 그보다 많이 들어온 줄은 "추가"
        (i < pendingRemoved ? marks.modified : marks.added).push(line + i);
      }
      line += count;
      pendingRemoved = 0;
    } else {
      flushRemoved();
      line += count;
    }
  }
  flushRemoved();

  return marks;
}

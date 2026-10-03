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

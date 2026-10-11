import { diffArrays } from "diff";

// 3-way 병합: "기준(제출 당시 원본)"에서 "내 변경"과 "최신 원본"이 각각 무엇을 바꿨는지 보고 하나로 합친다.
// - 서로 다른 곳을 고쳤으면 자동으로 합친다
// - 같은 곳(또는 바로 붙은 줄)을 다르게 고쳤으면 "겹침(conflict)"으로 돌려주고 사람이 고르게 한다
// 코드는 실행하지 않고 줄 단위 텍스트로만 다룬다

export type MergeSegment =
  | { type: "ok"; lines: string[] } // 그대로 쓰면 되는 부분
  | { type: "conflict"; base: string[]; mine: string[]; theirs: string[] }; // 양쪽이 다르게 고친 부분

export type MergeResult = { segments: MergeSegment[]; conflicts: number };

// 겹침마다 무엇을 쓸지. 나중에 AI 추천을 붙인다면 이 값의 배열만 만들어 주면 된다
export type ConflictChoice = "mine" | "theirs" | "both";

// 한쪽이 기준의 [start, end) 줄을 lines로 바꿨다는 뜻 (start === end면 그 자리에 끼워 넣기)
type Hunk = { start: number; end: number; lines: string[]; side: "mine" | "theirs" };

function hunksOf(base: string[], changed: string[], side: Hunk["side"]): Hunk[] {
  const hunks: Hunk[] = [];
  let index = 0; // 기준에서의 현재 줄 위치
  let current: Hunk | null = null;
  for (const part of diffArrays(base, changed)) {
    if (!part.added && !part.removed) {
      current = null; // 안 바뀐 줄을 만나면 묶음이 끝난다
      index += part.value.length;
      continue;
    }
    if (!current) {
      current = { start: index, end: index, lines: [], side };
      hunks.push(current);
    }
    if (part.removed) {
      index += part.value.length;
      current.end = index;
    } else {
      current.lines.push(...part.value);
    }
  }
  return hunks;
}

// 기준의 [start, end) 구간에 한쪽의 변경들만 적용한 결과
function applyHunks(base: string[], start: number, end: number, hunks: Hunk[]): string[] {
  const out: string[] = [];
  let index = start;
  for (const hunk of hunks) {
    out.push(...base.slice(index, hunk.start), ...hunk.lines);
    index = hunk.end;
  }
  out.push(...base.slice(index, end));
  return out;
}

const sameLines = (a: string[], b: string[]) => a.length === b.length && a.every((line, i) => line === b[i]);

export function threeWayMerge(baseCode: string, mineCode: string, theirsCode: string): MergeResult {
  const base = baseCode.split("\n");
  const all = [...hunksOf(base, mineCode.split("\n"), "mine"), ...hunksOf(base, theirsCode.split("\n"), "theirs")].sort(
    (a, b) => a.start - b.start || a.end - b.end
  );

  const segments: MergeSegment[] = [];
  const pushOk = (lines: string[]) => {
    if (lines.length === 0) return;
    const last = segments[segments.length - 1];
    if (last?.type === "ok") last.lines.push(...lines);
    else segments.push({ type: "ok", lines: [...lines] });
  };

  let index = 0; // 기준에서 여기까지 처리했다
  let i = 0;
  while (i < all.length) {
    // 서로 겹치거나 맞닿은 변경들을 한 묶음으로 모은다
    const group = [all[i]];
    const start = all[i].start;
    let end = all[i].end;
    i++;
    while (i < all.length && all[i].start <= end) {
      group.push(all[i]);
      end = Math.max(end, all[i].end);
      i++;
    }

    pushOk(base.slice(index, start));
    const mine = applyHunks(base, start, end, group.filter((h) => h.side === "mine"));
    const theirs = applyHunks(base, start, end, group.filter((h) => h.side === "theirs"));
    const original = base.slice(start, end);

    if (sameLines(mine, theirs)) pushOk(mine); // 양쪽이 똑같이 고침
    else if (sameLines(theirs, original)) pushOk(mine); // 나만 고침
    else if (sameLines(mine, original)) pushOk(theirs); // 최신 원본만 바뀜
    else segments.push({ type: "conflict", base: original, mine, theirs });
    index = end;
  }
  pushOk(base.slice(index));

  return { segments, conflicts: segments.filter((s) => s.type === "conflict").length };
}

// 겹침마다 고른 값으로 최종 코드를 만든다. choices[n]은 n번째 겹침의 선택 (없으면 "최신 원본" 쪽을 쓴다)
export function resolveMerge(result: MergeResult, choices: ConflictChoice[] = []): string {
  const lines: string[] = [];
  let conflictIndex = 0;
  for (const segment of result.segments) {
    if (segment.type === "ok") {
      lines.push(...segment.lines);
      continue;
    }
    const choice = choices[conflictIndex++] ?? "theirs";
    if (choice === "mine") lines.push(...segment.mine);
    else if (choice === "theirs") lines.push(...segment.theirs);
    else lines.push(...segment.theirs, ...segment.mine); // 둘 다: 최신 원본 → 내 변경 순서
  }
  return lines.join("\n");
}

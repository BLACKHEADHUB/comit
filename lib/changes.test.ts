import { describe, expect, it } from "vitest";
import { changedLineMarks, initialStatusFor, summarizeChanges } from "@/lib/changes";

describe("summarizeChanges", () => {
  it("같은 코드면 모두 0", () => {
    expect(summarizeChanges("a\nb\n", "a\nb\n")).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(summarizeChanges("", "")).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("줄을 추가하면 추가만 센다", () => {
    expect(summarizeChanges("a\nb\n", "a\nb\nc\nd\n")).toEqual({ added: 2, removed: 0, changed: 2 });
  });

  it("줄을 지우면 삭제만 센다", () => {
    expect(summarizeChanges("a\nb\nc\n", "a\nc\n")).toEqual({ added: 0, removed: 1, changed: 1 });
  });

  it("한 줄을 고치면 추가 1, 삭제 1이지만 바뀐 줄은 1", () => {
    expect(summarizeChanges("a\nb\nc\n", "a\nB\nc\n")).toEqual({ added: 1, removed: 1, changed: 1 });
  });

  it("떨어진 두 곳을 고치면 각각 더한다", () => {
    const before = "1\n2\n3\n4\n5\n";
    const after = "one\n2\n3\n4\nfive\nsix\n";
    expect(summarizeChanges(before, after)).toEqual({ added: 3, removed: 2, changed: 3 });
  });

  it("빈 원본에 처음 코드를 쓰는 경우", () => {
    expect(summarizeChanges("", "print('hi')\nprint('bye')")).toEqual({ added: 2, removed: 0, changed: 2 });
  });
});

describe("changedLineMarks", () => {
  it("같은 코드면 표시 없음", () => {
    expect(changedLineMarks("a\nb\n", "a\nb\n")).toEqual({ added: [], modified: [], deletedAt: [] });
  });

  it("새 줄은 added", () => {
    expect(changedLineMarks("a\nb\n", "a\nx\ny\nb\n")).toEqual({ added: [2, 3], modified: [], deletedAt: [] });
  });

  it("고친 줄은 modified", () => {
    expect(changedLineMarks("a\nb\nc\n", "a\nB\nc\n")).toEqual({ added: [], modified: [2], deletedAt: [] });
  });

  it("한 줄을 두 줄로 바꾸면 첫 줄은 modified, 나머지는 added", () => {
    expect(changedLineMarks("a\nb\nc\n", "a\nB1\nB2\nc\n")).toEqual({ added: [3], modified: [2], deletedAt: [] });
  });

  it("지우기만 하면 그 자리의 다음 줄에 삭제 표시", () => {
    expect(changedLineMarks("a\nb\nc\n", "a\nc\n")).toEqual({ added: [], modified: [], deletedAt: [2] });
  });

  it("두 줄을 한 줄로 바꾸면 수정 1 + 그 아래에 삭제 표시", () => {
    expect(changedLineMarks("a\nb\nc\nd\n", "a\nB\nd\n")).toEqual({ added: [], modified: [2], deletedAt: [3] });
  });

  it("맨 끝 줄을 지우면 마지막 줄을 넘지 않는 위치에 표시", () => {
    const marks = changedLineMarks("a\nb\nc", "a\nb");
    expect(marks.added).toEqual([]);
    // 줄바꿈 유무 때문에 b가 "수정"으로 잡히거나 삭제 표시가 2번 줄에 남는다. 어느 쪽이든 2번 줄을 넘지 않는다
    expect([...marks.modified, ...marks.deletedAt].every((n) => n <= 2)).toBe(true);
    expect(marks.modified.length + marks.deletedAt.length).toBeGreaterThan(0);
  });

  it("빈 원본에 처음 코드를 쓰면 전부 added", () => {
    expect(changedLineMarks("", "x\ny")).toEqual({ added: [1, 2], modified: [], deletedAt: [] });
  });
});

describe("initialStatusFor", () => {
  it("에디터를 연 뒤 원본이 그대로면 대기로 시작한다", () => {
    expect(initialStatusFor("A", "A")).toBe("PENDING");
  });

  it("그 사이 원본이 바뀌었다면(B가 먼저 병합) 옛 원본(A) 기준의 제출은 바로 다시 제출 필요로 시작한다", () => {
    expect(initialStatusFor("A", "B")).toBe("STALE");
  });
});

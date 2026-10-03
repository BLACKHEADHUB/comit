import { describe, expect, it } from "vitest";
import { filterSubmissions, inTab, TAB_FILTERS, type TaskTab } from "@/lib/tasks";
import type { SubmissionStatus } from "@/lib/validation";

const s = (author: string, status: SubmissionStatus) => ({ author, status });
const TABS: TaskTab[] = ["REVIEW", "MINE", "HISTORY"];

describe("inTab", () => {
  it("리뷰할 것: 남이 올린 대기 중 제출만", () => {
    expect(inTab(s("지수", "PENDING"), "REVIEW", "민수")).toBe(true);
    expect(inTab(s("민수", "PENDING"), "REVIEW", "민수")).toBe(false);
    expect(inTab(s("지수", "MERGED"), "REVIEW", "민수")).toBe(false);
    expect(inTab(s("지수", "STALE"), "REVIEW", "민수")).toBe(false);
  });

  it("내 제안: 내가 올린 것은 상태와 상관없이 전부", () => {
    for (const status of ["PENDING", "MERGED", "STALE"] as const) {
      expect(inTab(s("민수", status), "MINE", "민수")).toBe(true);
      expect(inTab(s("지수", status), "MINE", "민수")).toBe(false);
    }
  });

  it("반영된 기록: 처리가 끝난 것만 (누가 올렸든)", () => {
    expect(inTab(s("지수", "MERGED"), "HISTORY", "민수")).toBe(true);
    expect(inTab(s("민수", "STALE"), "HISTORY", "민수")).toBe(true);
    expect(inTab(s("지수", "PENDING"), "HISTORY", "민수")).toBe(false);
  });

  it("어떤 제출도 목록에서 사라지지 않는다 (탭 + 그 탭의 상태 필터 중 하나에는 반드시 보인다)", () => {
    for (const author of ["민수", "지수"]) {
      for (const status of ["PENDING", "MERGED", "STALE"] as const) {
        const item = s(author, status);
        const visibleSomewhere = TABS.some((tab) =>
          TAB_FILTERS[tab].some((filter) => filterSubmissions([item], tab, "민수", filter).length === 1)
        );
        expect(visibleSomewhere).toBe(true);
      }
    }
  });
});

describe("filterSubmissions", () => {
  const list = [s("민수", "PENDING"), s("지수", "PENDING"), s("민수", "MERGED"), s("지수", "STALE"), s("민수", "STALE")];

  it("탭과 상태 필터를 함께 적용하고 순서를 유지한다", () => {
    expect(filterSubmissions(list, "MINE", "민수", "ALL")).toEqual([list[0], list[2], list[4]]);
    expect(filterSubmissions(list, "MINE", "민수", "STALE")).toEqual([list[4]]);
    expect(filterSubmissions(list, "REVIEW", "민수", "PENDING")).toEqual([list[1]]);
    expect(filterSubmissions(list, "HISTORY", "민수", "MERGED")).toEqual([list[2]]);
    expect(filterSubmissions(list, "HISTORY", "민수", "STALE")).toEqual([list[3], list[4]]);
  });

  it("빈 목록이면 빈 결과", () => {
    expect(filterSubmissions([], "REVIEW", "민수", "PENDING")).toEqual([]);
  });
});

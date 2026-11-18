import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPolling } from "@/lib/polling";

// 브라우저의 document/window를 흉내 낸다 (이벤트 등록/발생만 필요)
let fakeDocument: EventTarget & { hidden: boolean };
let fakeWindow: EventTarget;

beforeEach(() => {
  vi.useFakeTimers();
  fakeDocument = Object.assign(new EventTarget(), { hidden: false });
  fakeWindow = new EventTarget();
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("window", fakeWindow);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("startPolling", () => {
  it("정해진 간격마다 부른다 (시작하자마자 부르지는 않는다)", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const stop = startPolling(run, 15_000);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(3);
    stop();
  });

  it("탭이 숨겨져 있으면 부르지 않는다", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const stop = startPolling(run, 15_000);
    fakeDocument.hidden = true;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).not.toHaveBeenCalled();
    stop();
  });

  it("탭이 다시 보이거나 창에 포커스가 돌아오면 바로 부른다", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const stop = startPolling(run, 15_000);

    fakeDocument.hidden = true;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    expect(run).not.toHaveBeenCalled(); // 숨겨질 때는 부르지 않는다

    fakeDocument.hidden = false;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    fakeWindow.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it("이전 호출이 끝나지 않았으면 겹쳐 부르지 않는다", async () => {
    let finish = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const stop = startPolling(run, 15_000);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(run).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it("run이 실패해도 멈추지 않고 다음 차례에 다시 부른다", async () => {
    const run = vi.fn().mockRejectedValue(new Error("offline"));
    const stop = startPolling(run, 15_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it("멈춘 뒤에는 타이머도 이벤트도 반응하지 않는다", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const stop = startPolling(run, 15_000);
    stop();
    fakeWindow.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("연속 실패 횟수를 알려주고, 성공하면 0으로 돌아온다", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("x")).mockRejectedValueOnce(new Error("x")).mockResolvedValue(undefined);
    const health: number[] = [];
    const stop = startPolling(run, 15_000, (n) => health.push(n));
    await vi.advanceTimersByTimeAsync(45_000);
    expect(health).toEqual([1, 2, 0]);
    stop();
  });

  it("멈춘 뒤에는 상태를 알리지 않는다", async () => {
    let finish = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const health: number[] = [];
    const stop = startPolling(run, 15_000, (n) => health.push(n));
    await vi.advanceTimersByTimeAsync(15_000);
    stop();
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(health).toEqual([]);
  });
});

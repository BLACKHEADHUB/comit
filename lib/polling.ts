// 화면 자동 갱신 타이머 (브라우저 전용).
// - intervalMs마다 run을 부른다. 탭이 숨겨져 있으면 부르지 않는다
// - 창에 포커스가 돌아오거나 탭이 다시 보이면 기다리지 않고 바로 한 번 부른다
// - 이전 호출이 아직 끝나지 않았으면 겹쳐 부르지 않는다
// - onHealth(연속 실패 횟수)를 알려준다: 성공하면 0, 실패하면 1, 2, 3... (화면에 "연결이 불안정해요"를 띄우는 용도)
// 돌려주는 함수를 부르면 멈춘다
export function startPolling(run: () => Promise<void>, intervalMs: number, onHealth?: (failures: number) => void): () => void {
  let running = false;
  let stopped = false;
  let failures = 0;

  const tick = async () => {
    if (stopped || running || document.hidden) return;
    running = true;
    try {
      await run();
      failures = 0;
    } catch {
      // 네트워크가 잠깐 끊겨도 멈추지 않고 다음 차례에 다시 시도한다. 연속 실패 횟수만 알려준다
      failures += 1;
    } finally {
      if (!stopped) onHealth?.(failures);
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  const onVisible = () => {
    if (!document.hidden) void tick();
  };
  window.addEventListener("focus", onVisible);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    stopped = true;
    clearInterval(timer);
    window.removeEventListener("focus", onVisible);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

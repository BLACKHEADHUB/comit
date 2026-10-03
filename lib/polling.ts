// 화면 자동 갱신 타이머 (브라우저 전용).
// - intervalMs마다 run을 부른다. 탭이 숨겨져 있으면 부르지 않는다
// - 창에 포커스가 돌아오거나 탭이 다시 보이면 기다리지 않고 바로 한 번 부른다
// - 이전 호출이 아직 끝나지 않았으면 겹쳐 부르지 않는다
// 돌려주는 함수를 부르면 멈춘다
export function startPolling(run: () => Promise<void>, intervalMs: number): () => void {
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (stopped || running || document.hidden) return;
    running = true;
    try {
      await run();
    } catch {
      // 네트워크가 잠깐 끊겨도 조용히 넘어가고 다음 차례에 다시 시도한다
    } finally {
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

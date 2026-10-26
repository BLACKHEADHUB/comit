import { useSyncExternalStore } from "react";

// 화면 여러 곳(헤더 아바타, 멤버 목록)이 같은 "접속 중" 목록을 보도록 하는 작은 저장소 (브라우저 전용)
let online = new Set<string>();
const listeners = new Set<() => void>();

export function setOnline(nicknames: string[]) {
  const next = new Set(nicknames);
  if (next.size === online.size && [...next].every((n) => online.has(n))) return; // 바뀐 게 없으면 다시 그리지 않는다
  online = next;
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useIsOnline(nickname: string): boolean {
  return useSyncExternalStore(subscribe, () => online.has(nickname), () => false);
}

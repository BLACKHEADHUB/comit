"use client";

import { useSyncExternalStore } from "react";

// 시스템 다크모드를 구독한다 (Monaco/Diff 색상을 페이지 톤에 맞추는 용도). 서버 렌더에서는 라이트로 가정
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getSnapshot = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

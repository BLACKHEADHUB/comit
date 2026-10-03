"use client";

import { useCallback, useSyncExternalStore } from "react";

// CSS 미디어 쿼리 결과를 구독한다 (예: 좁은 화면인지). 서버 렌더에서는 false로 가정
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

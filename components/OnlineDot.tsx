"use client";

import { useIsOnline } from "@/lib/onlineStore";

// 아바타 옆 초록 점 (지금 프로젝트 화면을 보고 있는 팀원). 색만으로 알리지 않게 글자도 함께 쓴다
export default function OnlineDot({ nickname, withLabel = false }: { nickname: string; withLabel?: boolean }) {
  const online = useIsOnline(nickname);
  if (!online) return null;
  if (withLabel) return <span className="shrink-0 text-xs text-ok">● 접속 중</span>;
  return <span aria-label="접속 중" className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-ok ring-2 ring-background" />;
}

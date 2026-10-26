// "지금 접속 중" 판단 규칙 (순수 함수)
// 화면은 15초마다 서버에 물어보고, 서버는 그때마다(최대 1분에 한 번) 마지막 접속 시각을 적는다.
// 마지막 접속이 2분 안이면 접속 중으로 본다 (탭을 숨기면 묻지 않으므로 곧 사라진다)
export const PRESENCE_WRITE_INTERVAL_MS = 60_000;
export const ONLINE_WINDOW_MS = 120_000;

export function onlineNicknames(members: { nickname: string; lastSeenAt?: Date | null }[], now = new Date(), me?: string): string[] {
  return members
    .filter((m) => m.nickname === me || (m.lastSeenAt && now.getTime() - m.lastSeenAt.getTime() <= ONLINE_WINDOW_MS))
    .map((m) => m.nickname);
}

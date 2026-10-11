export type MemberView = { nickname: string; role: "LEADER" | "MEMBER"; isMe: boolean };

// 아바타에 넣을 첫 글자 (이모지처럼 두 칸짜리 글자도 깨지지 않게 Array.from으로 자른다)
export function initialOf(nickname: string): string {
  const first = Array.from(nickname.trim())[0];
  return first ? first.toUpperCase() : "?";
}

// 보여주는 순서: 팀장 → 나 → 나머지(들어온 순서 유지)
export function orderMembers(members: { nickname: string; role: "LEADER" | "MEMBER" }[], me: string): MemberView[] {
  const rank = (m: MemberView) => (m.role === "LEADER" ? 0 : m.isMe ? 1 : 2);
  return members
    .map((m, index) => ({ view: { nickname: m.nickname, role: m.role, isMe: m.nickname === me }, index }))
    .sort((a, b) => rank(a.view) - rank(b.view) || a.index - b.index)
    .map((x) => x.view);
}

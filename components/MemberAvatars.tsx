import { ReissueCodeButton, TransferLeaderButton } from "@/components/MemberMenuActions";
import { initialOf, type MemberView } from "@/lib/members";

const MAX_SHOWN = 4; // 헤더에 겹쳐 보여줄 최대 아바타 수 (나머지는 +N)

function Avatar({ member, overlap = false }: { member: MemberView; overlap?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-background ${
        member.isMe ? "bg-accent text-white" : "bg-accent-soft text-accent-ink"
      } ${overlap ? "-ml-1.5" : ""}`}
    >
      {initialOf(member.nickname)}
      {/* 팀장은 색이 아니라 왕관으로 구분한다 */}
      {member.role === "LEADER" && <span className="absolute -top-2 -right-1 text-[10px]">👑</span>}
    </span>
  );
}

// 헤더의 팀 표시: 이니셜 아바타 묶음. 누르면 전체 멤버 목록이 펼쳐진다 (<details>라 JS 없이 키보드로도 동작)
export default function MemberAvatars({ members, projectId, isLeader }: { members: MemberView[]; projectId: string; isLeader: boolean }) {
  const shown = members.slice(0, MAX_SHOWN);
  const rest = members.length - shown.length;

  return (
    <details className="relative">
      <summary
        aria-label={`멤버 ${members.length}명 보기`}
        className="flex cursor-pointer list-none items-center rounded-full py-1 pr-1 pl-1.5 transition hover:bg-surface [&::-webkit-details-marker]:hidden"
      >
        {shown.map((m, i) => (
          <Avatar key={m.nickname} member={m} overlap={i > 0} />
        ))}
        {rest > 0 && <span className="ml-1 text-xs text-muted">+{rest}</span>}
        <span className="ml-1.5 text-xs text-muted">{members.length}명</span>
      </summary>
      <ul className="absolute right-0 z-20 mt-1 max-h-64 w-60 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line bg-background p-1.5 text-sm text-foreground shadow-xl">
        {members.map((m) => (
          <li key={m.nickname} className="rounded-lg px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Avatar member={m} />
              <span className="min-w-0 flex-1 truncate">{m.nickname}</span>
              <span className="shrink-0 text-xs text-muted">
                {m.role === "LEADER" ? "팀장" : "팀원"}
                {m.isMe && " · 나"}
              </span>
            </div>
            {/* 팀장만, 자기가 아닌 멤버에게 팀장을 넘길 수 있다 */}
            {isLeader && !m.isMe && (
              <div className="mt-1 pl-8">
                <TransferLeaderButton projectId={projectId} nickname={m.nickname} />
              </div>
            )}
          </li>
        ))}
        <li className="mt-1 border-t border-line px-2 pt-1.5 pb-0.5">
          <ReissueCodeButton projectId={projectId} />
        </li>
      </ul>
    </details>
  );
}

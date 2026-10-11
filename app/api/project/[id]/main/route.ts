import { findMember } from "@/lib/auth";

// "최신 원본 보기"용: 지금 시점의 원본(mainCode)을 돌려준다 (읽기 전용, 사용자가 버튼을 눌렀을 때만 호출)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 이 프로젝트의 멤버만 조회 가능 (멀티테넌시 격리). 멤버가 아니면 존재 여부도 알려주지 않는다
  const member = await findMember(id);
  if (!member) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ mainCode: member.project.mainCode }, { headers: { "Cache-Control": "no-store" } });
}

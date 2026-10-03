import { findMember } from "@/lib/auth";
import { listSubmissions } from "@/lib/submissions";

// 자동 갱신용: 프로젝트의 제출 목록을 다시 가져온다 (읽기 전용)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 이 프로젝트의 멤버만 조회 가능 (멀티테넌시 격리). 멤버가 아니면 존재 여부도 알려주지 않는다
  const member = await findMember(id);
  if (!member) return Response.json({ error: "not found" }, { status: 404 });

  const submissions = await listSubmissions(member.project._id);
  return Response.json({ submissions }, { headers: { "Cache-Control": "no-store" } });
}

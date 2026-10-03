import { findMember } from "@/lib/auth";
import { listSubmissions } from "@/lib/submissions";
import { codeVersion } from "@/lib/version";

// 자동 갱신용: 프로젝트의 제출 목록을 다시 가져온다 (읽기 전용)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 이 프로젝트의 멤버만 조회 가능 (멀티테넌시 격리). 멤버가 아니면 존재 여부도 알려주지 않는다
  const member = await findMember(id);
  if (!member) return Response.json({ error: "not found" }, { status: 404 });

  const submissions = await listSubmissions(member.project._id);
  // 원본이 바뀌었는지 화면이 알 수 있도록 버전(해시)만 함께 보낸다 (코드 본문은 보내지 않는다)
  const mainVersion = codeVersion(member.project.mainCode);
  return Response.json({ submissions, mainVersion }, { headers: { "Cache-Control": "no-store" } });
}

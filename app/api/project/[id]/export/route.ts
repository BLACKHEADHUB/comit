import { findMember } from "@/lib/auth";

// 현재 원본 코드를 파일로 내려받는다 (프로젝트가 정리·삭제되기 전에 보관할 수 있게)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 이 프로젝트의 멤버만 내려받을 수 있다 (멀티테넌시 격리)
  const member = await findMember(id);
  if (!member) return new Response("not found", { status: 404 });

  return new Response(member.project.mainCode, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="comit-code.txt"',
      "Cache-Control": "no-store",
    },
  });
}

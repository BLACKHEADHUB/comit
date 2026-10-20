import { connectDB } from "@/lib/db";

// 서비스가 살아 있는지 확인하는 주소 (업타임 모니터링용). DB 연결만 확인하고, 내부 정보는 알려주지 않는다
export async function GET() {
  try {
    await connectDB();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

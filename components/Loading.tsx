import Mascot from "@/components/Mascot";

// 로딩 표시: 생각 중인 코밋이 + 무엇을 기다리는지 한 문장
export default function Loading({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-center gap-2.5 p-4 text-sm text-muted">
      <Mascot mood="thinking" size={36} className="animate-pulse" />
      {text}
    </p>
  );
}

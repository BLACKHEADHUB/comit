import Mascot, { type MascotMood } from "@/components/Mascot";

type Props = {
  id?: string; // 제목 id (dialog의 aria-labelledby와 연결)
  mood: MascotMood;
  title: string;
  children?: React.ReactNode; // 제목 아래 설명
};

// 모든 모달이 함께 쓰는 머리 부분: 코밋이 + 제목 + 한두 줄 설명
export default function ModalHeader({ id, mood, title, children }: Props) {
  return (
    <div className="flex items-start gap-3 text-left">
      <Mascot mood={mood} size={44} className="-mt-1" />
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {children && <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>}
      </div>
    </div>
  );
}

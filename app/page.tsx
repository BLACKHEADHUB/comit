import NicknameForm from "@/components/NicknameForm";
import { createProject } from "@/app/actions/project";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Comit</h1>
        <p className="mt-1 text-sm text-zinc-500">터미널 없이, 웹에서 팀 코드 협업을 시작해요.</p>
      </div>
      <NicknameForm action={createProject} submitLabel="프로젝트 만들기" withProjectFields />
    </main>
  );
}

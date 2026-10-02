import CreateProjectForm from "@/components/CreateProjectForm";

export default function CreateProjectPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">프로젝트 만들기</h1>
        <p className="mt-1 text-sm text-zinc-500">닉네임을 입력하면 팀장으로 프로젝트가 만들어져요.</p>
      </div>
      <CreateProjectForm />
    </main>
  );
}

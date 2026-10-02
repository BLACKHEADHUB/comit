import LandingModal from "@/components/LandingModal";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Comit</h1>
        <p className="mt-1 text-sm text-zinc-500">터미널 없이, 웹에서 팀 코드 협업을 시작해요.</p>
      </div>
      <div>
        <LandingModal />
      </div>
      <p className="text-sm text-zinc-500">팀장에게 초대 링크를 받았다면, 링크를 열어 닉네임만 입력하면 바로 참여할 수 있어요.</p>
    </main>
  );
}

import Loading from "@/components/Loading";

// 제출 상세(리뷰) 화면으로 이동하는 동안 보이는 임시 화면
export default function SubmissionLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6" aria-busy="true">
      <span className="h-4 w-36 animate-pulse rounded bg-surface" />
      <Loading text="제출을 불러오고 있어요..." />
      <div className="h-28 animate-pulse rounded-2xl bg-surface" />
      <div className="h-72 animate-pulse rounded-2xl bg-surface" />
    </main>
  );
}

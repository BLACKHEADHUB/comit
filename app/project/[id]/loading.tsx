import Loading from "@/components/Loading";

// 프로젝트 화면으로 이동하는 동안 보이는 임시 화면 (서버가 데이터를 가져오는 시간)
export default function ProjectLoading() {
  return (
    <main className="flex h-dvh w-full flex-col" aria-busy="true">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="text-base font-bold tracking-tight">
          Comit<span className="text-accent-ink">.</span>
        </span>
        <span className="h-4 w-40 animate-pulse rounded bg-surface" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* 제출 목록 자리 */}
        <aside className="flex w-full flex-col gap-2 border-b border-line p-3 md:w-80 md:border-r md:border-b-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </aside>
        {/* 에디터 자리 */}
        <section className="flex min-w-0 flex-1 flex-col">
          <Loading text="프로젝트를 불러오고 있어요..." />
          <div className="m-3 mt-0 flex-1 animate-pulse rounded-2xl bg-surface" />
        </section>
      </div>
    </main>
  );
}

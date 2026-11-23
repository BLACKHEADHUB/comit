import Link from "next/link";
import type { ReactNode } from "react";
import PrintButton from "@/components/PrintButton";
import { REPORT_WEEKS, teamTotals, type ContributionRow } from "@/lib/contribution";
import { formatTime } from "@/lib/tags";
import { badge, card } from "@/lib/ui";

const ROLE_LABEL: Record<ContributionRow["role"], string> = { LEADER: "👑 팀장", MEMBER: "팀원", LEFT: "나간 팀원" };

// 주별 활동 칸: 활동이 많을수록 진하게 (색만으로 구분하지 않게 숫자를 title로도 준다)
function WeekCells({ weekly }: { weekly: number[] }) {
  const max = Math.max(1, ...weekly);
  return (
    <div className="flex gap-0.5" aria-label={`최근 ${REPORT_WEEKS}주 활동: ${weekly.join(", ")}`}>
      {weekly.map((n, i) => (
        <span
          key={i}
          title={`${REPORT_WEEKS - 1 - i === 0 ? "이번 주" : `${REPORT_WEEKS - 1 - i}주 전`}: ${n}번`}
          className="size-4 rounded-[4px] ring-1 ring-line print:ring-line-strong"
          style={{ background: n === 0 ? "transparent" : `color-mix(in srgb, var(--accent) ${25 + (n / max) * 75}%, transparent)` }}
        />
      ))}
    </div>
  );
}

// 팀원별 기여도 리포트 화면 (팀원이 보는 화면과 강사가 보는 화면이 같이 쓴다)
export default function ContributionReport({
  title, rows, now, backHref, backLabel, children,
}: {
  title: string;
  rows: ContributionRow[];
  now: Date;
  backHref: string;
  backLabel: string;
  children?: ReactNode; // 표 아래에 붙일 추가 영역 (예: 팀장의 수업 연결 칸, 강사용 최종 코드)
}) {
  const totals = teamTotals(rows);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 print:max-w-none print:py-0">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href={backHref} className="text-sm text-muted transition hover:text-foreground">
          ← {backLabel}
        </Link>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      <header>
        <p className="text-xs text-muted">Comit 팀 기여도 리포트 · {formatTime(now.toISOString())} 기준</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">
          누가 코드를 올리고, 얼마나 반영되고, 누구의 코드를 리뷰했는지 기록으로 보여줘요. 숫자는 참고 자료예요. 설계·회의·자료 조사처럼 여기 남지 않는 기여도 있으니 팀원끼리 함께 읽어주세요.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "올린 제출", value: totals.submitted },
          { label: "원본에 반영", value: totals.merged },
          { label: "리뷰 댓글", value: totals.reviews },
        ].map((t) => (
          <div key={t.label} className={`${card} px-4 py-3`}>
            <p className="text-xs text-muted">{t.label}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{t.value}</p>
          </div>
        ))}
      </section>

      {totals.quiet.length > 0 && totals.submitted > 0 && (
        <p role="status" className="rounded-xl bg-surface px-3 py-2 text-sm print:hidden">
          💬 최근 2주 동안 {totals.quiet.join(", ")} 님의 활동이 없어요. 막힌 부분이 없는지 먼저 말을 걸어보면 어때요?
        </p>
      )}

      <section className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[740px] whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">이름</th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium" title="올린 제출 중 원본에 반영된 수">반영 / 제출</th>
              <th scope="col" className="px-2 py-2.5 font-medium" title="반영된 제출에서 바뀐 줄 (한 줄 수정 = 1줄)">반영된 줄</th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium" title="팀원 제출에 남긴 댓글 (답글 제외)">리뷰</th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium">❓ 질문</th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium" title="버그 발견 (해결 완료 수)">🐞 버그 (해결)</th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium" title="충돌(STALE)로 다시 얹어 해결한 제출">↻ 충돌</th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium">답글</th>
              <th scope="col" className="px-2 py-2.5 font-medium">최근 {REPORT_WEEKS}주</th>
              <th scope="col" className="px-4 py-2.5 font-medium">마지막 활동</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nickname} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  <span className="block">{r.nickname}</span>
                  <span className={`${badge} mt-0.5 !px-1.5 ${r.role === "LEADER" ? "bg-accent-soft text-accent-ink" : "bg-surface text-muted ring-1 ring-line"}`}>
                    {ROLE_LABEL[r.role]}
                  </span>
                </th>
                <td className="px-2 py-3 text-right tabular-nums">
                  {r.merged} / {r.submitted}
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-surface ring-1 ring-line" aria-hidden>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${r.lineShare}%` }} />
                    </div>
                    <span className="tabular-nums">
                      {r.linesChanged}줄 <span className="text-xs text-muted">({r.lineShare}%)</span>
                    </span>
                  </div>
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{r.reviews}</td>
                <td className="px-2 py-3 text-right tabular-nums">{r.questions}</td>
                <td className="px-2 py-3 text-right tabular-nums">
                  {r.bugsFound}
                  {r.bugsFound > 0 && <span className="ml-1 text-xs text-muted">({r.bugsResolved})</span>}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{r.staleCount}</td>
                <td className="px-2 py-3 text-right tabular-nums">{r.replies}</td>
                <td className="px-2 py-3">
                  <WeekCells weekly={r.weekly} />
                </td>
                <td className="px-4 py-3 text-xs text-muted">{r.lastActiveAt ? formatTime(r.lastActiveAt.toISOString()) : "아직 없음"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <details className="text-xs text-muted">
        <summary className="cursor-pointer">숫자는 이렇게 세요</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>반영된 줄: 팀장이 병합한 제출에서 원본과 달라진 줄 수예요. 한 줄을 고치면 1줄로 세요. 아직 대기 중이거나 다시 제출이 필요한 제출은 넣지 않아요.</li>
          <li>리뷰 · 질문 · 버그(해결): 다른 팀원의 제출에 남긴 댓글이에요. 괄호 안 숫자는 해결 완료로 표시된 버그 수예요.</li>
          <li>↻ 충돌: 다른 변경이 먼저 병합돼 ‘다시 제출 필요(STALE)’ 상태를 겪은 제출 수예요.</li>
          <li>최근 {REPORT_WEEKS}주: 한 칸이 일주일이고, 오른쪽 끝이 이번 주예요. 제출과 댓글을 합친 횟수가 많을수록 진해요.</li>
          <li>지운 제출·댓글과 정리된 기록은 세지 않아요.</li>
        </ul>
      </details>
      {children}
    </main>
  );
}

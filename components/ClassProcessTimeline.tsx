"use client";

import { useState } from "react";
import ChangePreview from "@/components/ChangePreview";
import type { ClassTimelineItem } from "@/lib/classTimeline";
import { formatTime } from "@/lib/tags";
import { badge, card } from "@/lib/ui";

const STATUS_STYLE = {
  MERGED: { label: "반영됨", cls: "bg-ok-soft text-ok" },
  PENDING: { label: "검토 대기", cls: "bg-accent-soft text-accent-ink" },
  STALE: { label: "충돌/재제출", cls: "bg-warn-soft text-warn" },
} as const;

type ViewMode = "code" | "diff";

// 강사·학생 공용 과정 타임라인: 점수 대신 팀이 코드를 발전시킨 흐름(제출 → 질문·버그 해결 → 반영)과 단계별 Diff를 확인한다
export default function ClassProcessTimeline({ items }: { items: ClassTimelineItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("diff");

  if (items.length === 0) {
    return (
      <section className={`${card} p-4`} aria-label="학습·협업 과정 타임라인">
        <h2 className="text-sm font-semibold">🧭 학습·협업 과정 타임라인</h2>
        <p className="mt-2 text-xs text-muted">아직 제출 기록이 없어요.</p>
      </section>
    );
  }

  return (
    <section className={`${card} flex flex-col gap-3 p-4`} aria-label="학습·협업 과정 타임라인">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">🧭 학습·협업 과정 타임라인</h2>
        <span className="text-xs text-muted">총 {items.length}번의 시도 (시간순)</span>
      </div>
      <p className="text-xs text-muted">
        최종 결과뿐 아니라 팀원들이 시행착오를 겪고 질문·버그를 해결해 온 흐름을 볼 수 있어요. 병합 완료된 단계는 당시 코드와 이전 단계 대비 변경점(Diff)을 함께 볼 수 있어요.
      </p>

      <ol className="flex flex-col gap-2">
        {items.map((item) => {
          const st = STATUS_STYLE[item.status];
          const isOpen = openId === item.id;
          return (
            <li key={item.id} className="rounded-xl border border-line bg-surface/50 px-3 py-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-muted">#{item.step}</span>
                  <span className={`${badge} ${st.cls}`}>{st.label}</span>
                  <span className="font-semibold text-foreground">{item.author}</span>
                  <span className="truncate text-foreground">{item.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted tabular-nums">
                  <span className="text-ok">+{item.addedLines}</span>
                  <span className="text-danger">-{item.removedLines}</span>
                  {item.questions > 0 && <span>❓ {item.questions}</span>}
                  {item.bugsFound > 0 && (
                    <span>
                      🐞 {item.bugsFound}({item.bugsResolved}해결)
                    </span>
                  )}
                  {item.likes > 0 && <span>👍 {item.likes}</span>}
                  {item.replies > 0 && <span>💬 {item.replies}</span>}
                  <span>{formatTime(item.createdAt)}</span>
                  {item.mergedCode !== null && (
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                      className="rounded-full border border-line bg-background px-2 py-0.5 text-[11px] font-medium text-accent-ink hover:bg-surface"
                    >
                      {isOpen ? "닫기" : "변화·코드 보기"}
                    </button>
                  )}
                </div>
              </div>
              {isOpen && item.mergedCode !== null && (
                <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-line bg-background p-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMode("diff")}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                        mode === "diff" ? "bg-accent-soft text-accent-ink" : "text-muted hover:text-foreground"
                      }`}
                    >
                      이전과 비교 (Diff)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("code")}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                        mode === "code" ? "bg-accent-soft text-accent-ink" : "text-muted hover:text-foreground"
                      }`}
                    >
                      전체 코드
                    </button>
                  </div>
                  {mode === "diff" ? (
                    <ChangePreview
                      before={item.previousMergedCode ?? ""}
                      after={item.mergedCode}
                      label="이전 원본에서"
                      emptyText="이전과 코드 내용이 같아요."
                    />
                  ) : (
                    <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-surface p-3 font-mono text-[11px] leading-relaxed text-foreground">
                      {item.mergedCode || "(빈 코드)"}
                    </pre>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

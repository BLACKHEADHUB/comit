import type { Flow, StepState } from "@/lib/flow";

// 단계 동그라미 모양: 색만으로 구분하지 않도록 기호(✓ / 숫자 / !)를 함께 쓴다
const DOT: Record<StepState, string> = {
  done: "bg-ok-soft text-ok",
  current: "bg-accent text-white",
  todo: "bg-surface text-muted ring-1 ring-line-strong",
  blocked: "bg-warn-soft text-warn ring-1 ring-warn/30",
};
const STATE_TEXT: Record<StepState, string> = { done: "완료", current: "지금 단계", todo: "아직", blocked: "막힘" };
const NEXT_TONE: Record<Flow["tone"], string> = { normal: "text-foreground", ok: "text-ok", warn: "text-warn" };

// 협업 흐름에서 지금 어디인지 + 다음에 뭘 하면 되는지 보여주는 바 (표시 전용)
export default function FlowSteps({ flow, compact = false }: { flow: Flow; compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <ol aria-label="진행 단계" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {flow.steps.map((step, i) => (
          <li key={step.label} aria-current={step.state === "current" ? "step" : undefined} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className={`h-px w-3 sm:w-5 ${step.state === "todo" ? "bg-line-strong" : "bg-ok"}`} />}
            <span aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${DOT[step.state]}`}>
              {step.state === "done" ? "✓" : step.state === "blocked" ? "!" : i + 1}
            </span>
            <span className={step.state === "current" || step.state === "blocked" ? "font-semibold" : step.state === "todo" ? "text-muted" : ""}>
              {step.label}
            </span>
            <span className="sr-only">({STATE_TEXT[step.state]})</span>
          </li>
        ))}
      </ol>
      <p className={`leading-relaxed ${compact ? "text-xs" : "text-sm"} ${NEXT_TONE[flow.tone]}`}>
        <span className="mr-1.5 font-semibold">다음 할 일</span>
        {flow.next}
      </p>
    </div>
  );
}

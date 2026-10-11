"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ModalHeader from "@/components/ModalHeader";
import { writeDraft } from "@/lib/draft";
import { resolveMerge, threeWayMerge, type ConflictChoice, type MergeResult } from "@/lib/rebase";
import { btnGhost, btnPrimary, modalCard, modalOverlay } from "@/lib/ui";

type Props = {
  projectId: string;
  beforeCode: string; // 제출 당시의 원본 (기준)
  afterCode: string; // 내가 제출한 코드
  latestMainCode: string; // 지금의 최신 원본
};

const CHOICES: { value: ConflictChoice; label: string; hint: string }[] = [
  { value: "theirs", label: "최신 원본 유지", hint: "먼저 병합된 변경을 그대로 둬요" },
  { value: "mine", label: "내 변경 쓰기", hint: "이 부분은 내 코드로 바꿔요" },
  { value: "both", label: "둘 다 넣기", hint: "최신 원본 아래에 내 코드를 이어 붙여요" },
];

// 코드 조각을 그대로(텍스트로만) 보여준다. 빈 조각은 "지워짐"으로 표시
function Snippet({ title, lines, tone }: { title: string; lines: string[]; tone: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-muted">{title}</p>
      <pre className={`max-h-40 overflow-auto rounded-lg border p-2 font-mono text-xs leading-relaxed ${tone}`}>
        {lines.length > 0 ? lines.join("\n") : "(이 부분을 지움)"}
      </pre>
    </div>
  );
}

// STALE 제출에서: 최신 원본 위에 내 변경을 다시 얹어 에디터로 가져간다.
// 서로 다른 곳을 고쳤으면 자동으로 합치고, 같은 곳을 고쳤으면 그 부분만 사용자가 고른다 (AI는 쓰지 않는다)
export default function RebaseHelper({ projectId, beforeCode, afterCode, latestMainCode }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<MergeResult | null>(null); // 겹침이 있어 고르는 중일 때만 값이 있다
  const [choices, setChoices] = useState<(ConflictChoice | undefined)[]>([]);

  // 합친 코드를 초안으로 저장하고 에디터 화면으로 이동한다 (반영은 다시 Comit → 리뷰 → 병합을 거친다)
  function sendToEditor(code: string) {
    writeDraft(projectId, { code, base: latestMainCode, fromStale: true, rebased: true });
    router.push(`/project/${projectId}`);
  }

  function start() {
    const merged = threeWayMerge(beforeCode, afterCode, latestMainCode);
    if (merged.conflicts === 0) {
      sendToEditor(resolveMerge(merged)); // 겹치는 곳이 없으면 바로 가져간다
      return;
    }
    setChoices(new Array(merged.conflicts).fill(undefined));
    setResult(merged);
  }

  // ESC 키로 창 닫기
  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setResult(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result]);

  const conflicts = result?.segments.filter((s) => s.type === "conflict") ?? [];
  const allChosen = choices.every((c) => c !== undefined);

  return (
    <>
      <button type="button" onClick={start} className={btnPrimary}>
        최신 원본에 내 변경 다시 얹기
      </button>
      {result && (
        <div className={modalOverlay} onClick={() => setResult(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rebase-title"
            onClick={(e) => e.stopPropagation()}
            className={`${modalCard} flex max-h-[calc(100dvh-2rem)] !max-w-2xl flex-col gap-4 overflow-y-auto text-left`}
          >
            <ModalHeader id="rebase-title" mood="thinking" title={`겹치는 부분이 ${conflicts.length}곳 있어요`}>
              먼저 병합된 변경과 내 변경이 같은 줄을 고쳤어요. 겹치지 않는 나머지는 자동으로 합쳤으니, 아래 부분만 어느 쪽을 쓸지 골라주세요.
            </ModalHeader>
            {conflicts.map((conflict, i) =>
              conflict.type !== "conflict" ? null : (
                <fieldset key={i} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                  <legend className="px-1 text-sm font-semibold">겹침 {i + 1}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Snippet title="최신 원본 (먼저 병합됨)" lines={conflict.theirs} tone="border-line bg-surface" />
                    <Snippet title="내 변경" lines={conflict.mine} tone="border-accent/40 bg-accent-soft" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CHOICES.map((choice) => (
                      <label
                        key={choice.value}
                        title={choice.hint}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                          choices[i] === choice.value
                            ? "border-accent bg-accent-soft font-semibold text-accent-ink"
                            : "border-line-strong text-muted hover:bg-surface hover:text-foreground"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`conflict-${i}`}
                          className="size-3 accent-[var(--accent)]"
                          checked={choices[i] === choice.value}
                          onChange={() => setChoices((prev) => prev.map((c, n) => (n === i ? choice.value : c)))}
                        />
                        {choice.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )
            )}
            <p className="text-xs leading-relaxed text-muted">
              고른 결과는 에디터로 가져가요. 거기서 더 고친 뒤 [Comit하기]를 누르면 다시 리뷰를 받을 수 있어요.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResult(null)} className={btnGhost}>
                취소
              </button>
              <button
                type="button"
                disabled={!allChosen}
                onClick={() => sendToEditor(resolveMerge(result, choices as ConflictChoice[]))}
                className={btnPrimary}
              >
                {allChosen ? "에디터로 가져가기" : "겹친 부분을 모두 골라주세요"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

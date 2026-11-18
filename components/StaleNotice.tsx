"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RebaseHelper from "@/components/RebaseHelper";
import { hasUnsentDraftEdits, writeDraft } from "@/lib/draft";
import { btnGhost, btnPrimary, btnSecondary, noticeWarn } from "@/lib/ui";

type Props = {
  projectId: string;
  isAuthor: boolean; // 내가 올린 제출인지 (다시 Comit은 작성자만 할 수 있다)
  author: string;
  beforeCode: string; // 제출 당시의 원본 (다시 얹기의 기준)
  afterCode: string; // 이 제출의 코드
  latestMainCode: string; // 지금 시점의 최신 원본 (에디터 초안의 기준값)
};

// "다시 제출 필요(STALE)" 안내 카드. 예전에는 같은 말이 배지 툴팁, 고정 문구, 병합 결과 박스, 진행 바에 흩어져 있었다.
// 한 곳에 모아서 "무슨 일이 있었나 → 내 코드는 안전한가 → 무엇을 하면 되나" 순서로 보여준다.
export default function StaleNotice({ projectId, isAuthor, author, beforeCode, afterCode, latestMainCode }: Props) {
  const router = useRouter();
  // 에디터에 작성 중인 코드가 있어서 확인을 기다리는 동작 (없으면 null)
  const [pendingGo, setPendingGo] = useState<(() => void) | null>(null);

  // 에디터로 가져가면 지금 작성 중인 코드를 덮어쓴다. 아직 Comit하지 않은 수정이 있을 때만 먼저 물어본다
  function guard(go: () => void) {
    if (hasUnsentDraftEdits(projectId, afterCode)) setPendingGo(() => go);
    else go();
  }

  // 합치지 않고 이 제출의 코드를 그대로 에디터로 불러온다
  function loadIntoEditor() {
    writeDraft(projectId, { code: afterCode, base: latestMainCode, fromStale: true });
    router.push(`/project/${projectId}`);
  }

  return (
    <section aria-label="다시 제출 안내" className={`${noticeWarn} flex w-full flex-col gap-2 text-left`}>
      {/* 1) 무슨 일이 있었나 (이 문장이 화면에서 STALE을 설명하는 유일한 곳이다) */}
      <p className="font-semibold">다른 변경이 먼저 병합돼서 이대로는 반영할 수 없어요.</p>

      {isAuthor ? (
        <>
          {/* 2) 내 코드는 안전한가 + 3) 무엇을 하면 되나 */}
          <p className="text-xs leading-relaxed">내 수정은 그대로 남아 있어요. 최신 원본 위에 내 변경만 합쳐서 다시 Comit하면 돼요.</p>
          <ol className="list-inside list-decimal space-y-0.5 text-xs leading-relaxed">
            <li>아래 버튼으로 최신 원본과 내 변경을 합쳐요</li>
            <li>에디터에서 합쳐진 코드를 확인해요</li>
            <li>[Comit하기]로 다시 제출하면 새로 리뷰를 받아요</li>
          </ol>
          <div className="flex flex-col items-start gap-1">
            <RebaseHelper
              projectId={projectId}
              beforeCode={beforeCode}
              afterCode={afterCode}
              latestMainCode={latestMainCode}
              guard={guard}
            />
            <p className="text-xs leading-relaxed">추천: 먼저 병합된 팀원의 변경은 지우지 않고, 내 변경만 그 위에 합쳐요.</p>
          </div>
          <div className="flex flex-col items-start gap-1">
            <button type="button" onClick={() => guard(loadIntoEditor)} className={`${btnSecondary} !text-xs`}>
              내 코드 그대로 에디터로 불러오기
            </button>
            <p className="text-xs leading-relaxed">합치지 않고 내 코드 전체를 가져와요. 먼저 병합된 변경이 빠질 수 있어요.</p>
          </div>
        </>
      ) : (
        // 작성자가 아닌 사람에게는 "내 수정"이라고 말하지 않고, 남의 코드를 내 에디터로 가져가는 버튼도 보여주지 않는다
        <p className="text-xs leading-relaxed">
          작성자인 {author}님이 최신 원본 위에 다시 Comit하면, 새 제출로 이어서 리뷰할 수 있어요.
        </p>
      )}

      {pendingGo && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-warn/30 bg-background p-3 text-xs text-foreground">
          <p className="leading-relaxed">
            지금 에디터에 아직 Comit하지 않은 코드가 있어요. 계속하면 그 코드는 사라져요.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPendingGo(null)} className={`${btnGhost} !text-xs`}>
              취소
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => {
                const go = pendingGo;
                setPendingGo(null);
                go();
              }}
              className={`${btnPrimary} !text-xs`}
            >
              계속하기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

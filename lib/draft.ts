// 에디터 초안을 브라우저(sessionStorage)에 임시 저장한다.
// 제출 상세 페이지로 이동했다가 돌아와도 작성 중인 코드가 사라지지 않게 하고,
// STALE 제출의 코드를 에디터로 불러올 때도 사용한다.
export type Draft = {
  code: string;
  base: string; // 초안을 만들 당시의 mainCode. 지금 mainCode와 다르면 초안은 오래된 것으로 보고 버린다
  fromStale?: boolean; // STALE 제출에서 불러온 코드인지
};

const key = (projectId: string) => `comit_draft_${projectId}`;

export function readDraft(projectId: string, currentMainCode: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key(projectId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    // 그 사이 mainCode가 바뀌었다면(다른 병합 등) 최신 mainCode를 보여주기 위해 초안을 버린다
    if (typeof draft.code !== "string" || draft.base !== currentMainCode) {
      sessionStorage.removeItem(key(projectId));
      return null;
    }
    return draft;
  } catch {
    return null; // 저장소를 못 쓰는 환경에서도 앱은 정상 동작
  }
}

export function writeDraft(projectId: string, draft: Draft) {
  try {
    // 수정 사항이 없으면 초안을 남기지 않는다
    if (draft.code === draft.base && !draft.fromStale) sessionStorage.removeItem(key(projectId));
    else sessionStorage.setItem(key(projectId), JSON.stringify(draft));
  } catch {}
}

export function clearDraft(projectId: string) {
  try {
    sessionStorage.removeItem(key(projectId));
  } catch {}
}

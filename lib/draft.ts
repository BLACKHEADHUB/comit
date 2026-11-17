// 에디터 초안을 브라우저(sessionStorage)에 임시 저장한다.
// 제출 상세 페이지로 이동했다가 돌아와도 작성 중인 코드가 사라지지 않게 하고,
// STALE 제출의 코드를 에디터로 불러올 때도 사용한다.
export type Draft = {
  code: string;
  base: string; // 초안을 만들 당시의 mainCode. 지금 mainCode와 다르면 초안은 오래된 것으로 보고 버린다
  fromStale?: boolean; // STALE 제출에서 불러온 코드인지
  rebased?: boolean; // 최신 원본 위에 내 변경을 다시 얹어 만든 코드인지 (안내 문구가 달라진다)
};

const key = (projectId: string) => `comit_draft_${projectId}`;

export function readDraft(projectId: string, currentMainCode: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key(projectId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    // 그 사이 mainCode가 바뀌었다면(다른 병합 등) 에디터에는 최신 mainCode를 보여준다.
    // 다만 사용자가 쓰던 코드는 지우지 않고 따로 보관해서, 나중에 최신 원본 위에 합칠 수 있게 한다
    if (typeof draft.code !== "string" || draft.base !== currentMainCode) {
      if (typeof draft.code === "string") stashOldDraft(projectId, draft);
      sessionStorage.removeItem(key(projectId));
      return null;
    }
    return draft;
  } catch {
    return null; // 저장소를 못 쓰는 환경에서도 앱은 정상 동작
  }
}

// 원본이 바뀐 뒤에도 남겨 둔 "예전 초안". 진짜 수정이 있고 아직 Comit하지 않은 것만 보관한다
const oldKey = (projectId: string) => `comit_olddraft_${projectId}`;

function stashOldDraft(projectId: string, draft: Draft) {
  const edited = draft.fromStale === true || draft.code !== draft.base;
  if (!edited || draft.code === readSubmitted(projectId)?.code) return; // 잃을 게 없으면 보관하지 않는다
  sessionStorage.setItem(oldKey(projectId), JSON.stringify({ code: draft.code, base: draft.base }));
}

// 보관해 둔 예전 초안을 꺼낸다. 원본이 다시 그 초안의 기준과 같아졌다면 합칠 필요가 없으므로 null
export function readOldDraft(projectId: string, currentMainCode: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(oldKey(projectId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (typeof draft.code !== "string" || typeof draft.base !== "string" || draft.base === currentMainCode) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearOldDraft(projectId: string) {
  try {
    sessionStorage.removeItem(oldKey(projectId));
  } catch {}
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

// 에디터에 "아직 Comit하지 않은 새 수정"이 있는지 본다.
// STALE 제출의 코드를 에디터로 가져오면 지금 초안을 덮어쓰므로, 그 전에 한 번 물어볼지 정하는 데 쓴다.
// - readDraft와 달리 원본이 바뀐 초안도 지우지 않고 "있는지만" 본다 (사용자의 작업이므로)
// - 이미 Comit한 코드(방금 제출한 코드, 가져오려는 제출의 코드)는 덮어써도 잃는 게 없어서 센 것에서 뺀다
export function hasUnsentDraftEdits(projectId: string, incomingCode?: string): boolean {
  try {
    const raw = sessionStorage.getItem(key(projectId));
    if (!raw) return false;
    const draft = JSON.parse(raw) as Draft;
    if (typeof draft.code !== "string") return false;
    const edited = draft.fromStale === true || draft.code !== draft.base; // 원본과 다른 수정이 있는지
    if (!edited) return false;
    if (draft.code === incomingCode) return false; // 가져올 코드와 같으면 덮어써도 그대로
    return draft.code !== readSubmitted(projectId)?.code; // 이미 보낸 코드면 잃지 않는다
  } catch {
    return false; // 저장소를 못 쓰는 환경에서는 확인 없이 진행
  }
}

// 방금 Comit한 코드를 기억한다. 에디터의 코드가 이것과 같으면 "이미 보낸 코드"라는 뜻이다
// (같은 내용을 실수로 두 번 Comit하지 않게 안내하는 용도. 탭을 닫으면 사라진다)
export type Submitted = { code: string; submissionId: string };

const submittedKey = (projectId: string) => `comit_submitted_${projectId}`;

export function readSubmitted(projectId: string): Submitted | null {
  try {
    const raw = sessionStorage.getItem(submittedKey(projectId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as Submitted;
    return typeof saved.code === "string" && typeof saved.submissionId === "string" ? saved : null;
  } catch {
    return null;
  }
}

export function writeSubmitted(projectId: string, submitted: Submitted) {
  try {
    sessionStorage.setItem(submittedKey(projectId), JSON.stringify(submitted));
  } catch {}
}

// 에디터 언어 선택 (Monaco는 언어에 맞춰 문법 검사/색상을 적용한다. 일반 텍스트는 검사하지 않는다)
export const LANGUAGES = [
  { value: "plaintext", label: "일반 텍스트" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
] as const;
export type Language = (typeof LANGUAGES)[number]["value"];

const langKey = (projectId: string) => `comit_lang_${projectId}`;
const langListeners = new Set<() => void>();

export function subscribeLanguage(cb: () => void) {
  langListeners.add(cb);
  return () => {
    langListeners.delete(cb);
  };
}

export function readLanguage(projectId: string): Language {
  try {
    const saved = sessionStorage.getItem(langKey(projectId));
    return LANGUAGES.find((l) => l.value === saved)?.value ?? "plaintext";
  } catch {
    return "plaintext";
  }
}

export function writeLanguage(projectId: string, language: Language) {
  try {
    sessionStorage.setItem(langKey(projectId), language);
  } catch {}
  langListeners.forEach((cb) => cb()); // 같은 탭의 화면을 즉시 갱신
}

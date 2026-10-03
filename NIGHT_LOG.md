# NIGHT_LOG

브랜치: `night/20261004` · 목표: "입문자가 지금 어디에 있고 다음에 뭘 해야 하는지 한눈에 아는 화면"

## 시작 점검 (2026-10-04)
- `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build` 모두 통과 확인.
- `app/invite/[token]/page.tsx`는 사용자가 수정 중인 파일 → 건드리지도 커밋하지도 않는다.
- 화면 용어는 기존 라벨 유지(지시서 기본값). 새 UI 문구만 "원본/다음 할 일" 말투 사용.
- 실제 DB/Gemini/Redis에 연결하지 않으므로 화면 점검(라이트/다크, 375px, 키보드)은 실제 렌더링이 아니라 코드 기준 점검이다.

## 백로그
- [x] 1. 안전망: Vitest 도입 + lib/validation.ts, lib/ai.ts, lib/draft.ts 단위 테스트
- [x] 2. DESIGN_NOTES.md 작성: 현재 화면 문제점 + 서비스별 패턴 매핑
- [x] 3. Comit 전 변경 미리보기 (미니 Diff + "원본에서 N줄 바뀜", 변경 없으면 제출 비활성)
- [x] 4. 에디터에 원본과 달라진 줄 표시 (Monaco 색 띠 + 상단 요약)
- [x] 5. 목록 카드 배지 (💬 댓글 수, 🐞 BUG 수, ⚠ AI 경고) — 서버 집계 쿼리 한 번
- [x] 6. 목록을 할 일 기준 탭으로 (내가 리뷰할 것 / 내 제안 / 반영된 기록)
- [x] 7. 진행 단계 바 (작성 → 제안함 → 리뷰 중 → 반영됨 + 다음 할 일)
- [x] 8. 댓글을 코드 줄에 붙이기 (Diff 줄 옆 말풍선 마커)
- [x] 9. 자동 갱신 (포커스 복귀 + 15초 폴링, 새 항목 점 표시)
- [ ] 10. 팀 표시 (이니셜 아바타 묶음, 팀장 👑)
- [ ] 11. 첫 진입 온보딩 (3단계 체크리스트 카드)
- [ ] 12. (선택) 댓글 답글/해결 처리
- [ ] 13. 백로그 이후: DESIGN_NOTES.md를 다시 보고 작고 안전한 UI 개선

## 진행 기록

### 1. 안전망: Vitest
- 계획: `vitest`를 devDependency로 추가, `vitest.config.mts`에 `@/` 별칭과 `server-only` 대체 모듈 설정.
  `lib/validation.test.ts`, `lib/ai.test.ts`(Gemini SDK는 mock, 실제 호출 없음), `lib/draft.test.ts`(sessionStorage는 가짜 객체) 작성.
- 확인 방법: `npm test`.
- 결과: 테스트 36개 통과. 최신 vitest 5.x는 `@types/node@^20`과 peer 충돌이 나서 호환되는 `vitest@^3`으로 설치했다(@types/node를 올리지 않기 위해).
- 검증: lint / tsc / test / build 모두 통과.

### 2. DESIGN_NOTES.md
- 계획: ProjectWorkspace / SubmissionDiff / MergePanel / LandingModal을 읽고 문제점과 서비스별 패턴 매핑을 문서로 정리. 코드 변경 없음.
- 결과: `DESIGN_NOTES.md` 작성(문제점, 패턴 매핑 표, 공통 원칙). LandingModal은 문제 없어 범위에서 제외.
- 참고: 시작 시점에 수정 중이던 `app/invite/[token]/page.tsx`는 그 사이 사용자가 직접 커밋(`844a459 d`)한 것으로 보인다. 내가 건드린 것은 없다.

### 3. Comit 전 변경 미리보기
- 계획: `lib/changes.ts`(+테스트)에 `summarizeChanges(before, after)` 추가 → `components/ChangePreview.tsx`(요약 + unified 미니 Diff, `next/dynamic` ssr:false)
  → `ProjectWorkspace`의 Comit 모달에 넣고 변경 없으면 제출 버튼 비활성. 패턴: GitHub 변경 요약 + Toss 확인 화면.
- 확인 방법: 에디터에서 코드를 고치고 [Comit하기] → 모달에 "원본에서 N줄 바뀜"과 미니 Diff. 안 고치고 누르면 버튼이 비활성.
- 결과: 모달에 요약(원본에서 N줄 바뀜, +추가/−삭제)과 unified 미니 Diff 추가. 변경이 없으면 안내 문구 + 제목 입력/제출 버튼 비활성. 테스트 6개 추가(총 42개).
- 화면 점검(코드 기준): 라이트/다크는 `useDarkTheme`+토큰, 375px은 모달 `w-full`+미니 Diff 상자 안에서만 스크롤, 키보드는 미리보기 영역 `tabIndex=0`·ESC 닫기 유지, 빈 상태(변경 없음)·에러 상태(기존 문구) 유지.
- 기준 원본은 페이지를 열 때 받은 mainCode다. 그 사이 다른 병합이 있었다면 서버가 최신 mainCode로 다시 비교한다(기존 동작 그대로).

### 4. 에디터에 원본과 달라진 줄 표시
- 계획: `lib/changes.ts`에 `changedLineMarks(before, after)`(+테스트) 추가 → `ProjectWorkspace`에서 Monaco `onMount`로 에디터를 잡아 decoration 갱신,
  `app/globals.css`에 띠 스타일(기존 토큰 사용) 추가, 에디터 상단에 "원본에서 N줄 바뀜" 요약. 패턴: VS Code/GitHub 거터 표시.
- 확인 방법: 에디터에서 줄을 추가/수정/삭제하면 줄 번호 옆에 띠가 생기고 상단 숫자가 바뀐다.
- 결과: 줄 번호 옆 띠(추가=초록, 수정=포인트색, 삭제 위치=빨간 가로선, 마우스 올리면 설명) + 상단 "원본에서 N줄 바뀜 · +a −b / 원본과 같아요". 테스트 7개 추가(총 49개).
- 화면 점검(코드 기준): 색은 토큰(`--ok/--accent/--danger`)이라 라이트/다크 자동 대응, 상단 요약은 `flex-wrap`으로 375px 대응, 색 외에 글자 요약 제공. 띠 자체는 Monaco 내부라 키보드 포커스 대상이 아니다(요약 글자가 대체 수단).
- 한계: 실제 브라우저에서 띠 모양을 눈으로 확인하지 못했다. 아침에 한 번 확인 필요(`app/globals.css`의 `.comit-line-*`).

### 5. 목록 카드 배지
- 계획: `lib/submissions.ts`에 projectId로 `$match`한 aggregate 한 번으로 목록+댓글 수+BUG 수+AI 경고 여부를 가져오는 `listSubmissions` 추가(행→화면용 변환은 순수 함수로 테스트).
  `SubmissionItem`에 선택이 아닌 표시용 필드 3개 추가(DB 스키마 변경 없음), `app/project/[id]/page.tsx`와 `createSubmission` 반환값, 카드 UI 수정. 패턴: GitHub PR 목록.
- 확인 방법: 댓글/버그 태그가 달린 제출 카드에 💬 🐞 배지가, AI 경고가 있는 제출에 ⚠ 배지가 보인다.
- 결과: 카드에 💬/🐞/⚠ 배지(0보다 클 때만). 기존 `find` 1회가 `aggregate` 1회로 바뀌었고 쿼리 수는 그대로 1번. 테스트 4개 추가(총 53개).
- 화면 점검(코드 기준): 배지는 토큰 색 + 이모지 + 숫자/글자 + `aria-label`, `flex-wrap`으로 좁은 폭 대응, 배지가 없으면 줄 자체를 그리지 않는다(빈 상태).
- ⚠ 한계: 실제 MongoDB에 연결하지 않았기 때문에 aggregate 파이프라인은 **모양만 테스트**했다(첫 단계 projectId `$match`, `$lookup` 1회, 코드 본문 미포함). `$lookup`의 `localField`+`pipeline` 조합은 MongoDB 5.0 이상이 필요하다(Atlas는 해당). 아침에 실제 프로젝트 화면에서 목록이 뜨는지 한 번 확인 필요.

### 6. 목록을 할 일 기준 탭으로
- 계획: `lib/tasks.ts`(+테스트)에 탭 분류 함수 추가 → `ProjectWorkspace` 사이드바 탭을 [리뷰할 것 / 내 제안 / 반영된 기록]으로 교체, 탭 안에 상태 칩 유지, 카드에 상태 표시.
  `app/project/[id]/page.tsx`에서 내 닉네임을 넘긴다. 패턴: Linear My Issues.
- 애매한 점과 결정: 남이 올린 STALE 제출은 "리뷰할 것"도 "내 제안"도 아니다 → "반영된 기록" 탭의 상태 칩(병합됨 / 다시 제출 필요)에서 볼 수 있게 했다. 그래야 어떤 제출도 목록에서 사라지지 않는다.
- 확인 방법: 팀원 계정으로 들어가면 남의 대기 제출이 "리뷰할 것"에, 내가 올린 것이 "내 제안"에 보인다.
- 결과: 탭 [리뷰할 것 / 내 제안 / 반영된 기록] + 탭 안 상태 칩(내 제안: 전체/대기/병합됨/다시 제출 필요, 반영된 기록: 병합됨/다시 제출 필요). 카드에 상태 아이콘+라벨. Comit 성공 시 "내 제안" 탭으로 이동. 테스트 6개 추가(총 59개).
- 화면 점검(코드 기준): 탭은 `role=tablist/tab`+`aria-selected`, 칩은 `aria-pressed`, 전부 button이라 키보드 조작 가능. 탭별·필터별 빈 상태 문구 있음. 탭 라벨은 좁은 폭에서 줄바꿈(`leading-tight`).
- 주의: 모바일(세로 배치)에서는 사이드바 높이가 `max-h-56`이라 칩 줄이 생기면 목록이 한 줄 정도 덜 보인다. 스크롤은 된다.

### 7. 진행 단계 바
- 계획: `lib/flow.ts`(+테스트)에 단계 판정/다음 할 일 문구 함수 → `components/FlowSteps.tsx`(표시 전용) → 제출 상세(`SubmissionFlow`)와 에디터 아래에 배치.
  상태가 병합 직후 바로 바뀌어야 하므로 MergePanel 안에 있던 `status` 화면 상태를 `ReviewProvider`로 올린다(병합 로직/서버 액션은 손대지 않음). 패턴: Vercel 단계 표시.
- 확인 방법: 제출 상세 상단에 4단계 바와 "다음 할 일" 문장. 댓글을 달면 "리뷰 중"으로, 병합하면 "반영됨"으로 바뀐다.
- 결과: 제출 상세 상단과 에디터 아래에 4단계 바 + 역할별 "다음 할 일". STALE은 마지막 단계가 "원본이 먼저 바뀜(!)"으로 바뀌고 다시 Comit 안내. 테스트 7개 추가(총 66개).
- 구조 변경: `status` 화면 상태를 MergePanel → ReviewProvider로 옮겼다. `mergeSubmission` 서버 액션과 병합 조건은 그대로다.
- 고친 문제: 4번에서 넣은 "원본에서 N줄 바뀜"이 브라우저에만 있는 초안 값으로 그려져 hydration 불일치가 날 수 있었다 → 브라우저 준비 후에만 실제 요약을 쓰도록 수정.
- 화면 점검(코드 기준): 단계는 `ol`+`aria-current=step`+화면낭독기용 상태 글자, 색+기호(✓/숫자/!)+글자, `flex-wrap`으로 375px 대응, 토큰 색만 사용.

### 8. 댓글을 코드 줄에 붙이기
- 계획: `lib/comments.ts`(+테스트)에 줄별 묶기 함수 → `SubmissionDiff`에서 diff viewer의 `renderGutter`로 줄 옆 말풍선 버튼, `alwaysShowLines`로 댓글 줄이 접히지 않게, 누르면 옆 패널 해당 묶음으로 스크롤. 패턴: GitHub PR 리뷰.
- 확인 방법: 댓글이 있는 제출 상세에서 Diff 오른쪽 줄 번호 옆에 💬 숫자가 보이고, 누르면 그 줄 댓글로 이동한다.
- 결과: 변경 후 줄 번호 옆 칸에 💬N(버그 지적 있으면 🐞N) 버튼. 누르면 줄 강조 + 옆 패널 해당 묶음으로 스크롤/포커스. 댓글 달린 줄은 접히지 않음. 테스트 3개 추가(총 69개).
- 화면 점검(코드 기준): 말풍선은 `button`+`aria-label`이라 키보드로 누를 수 있다. 색은 토큰, 아이콘+숫자 병기. 댓글 없으면 칸이 비어 있고 기존 빈 상태 문구 유지.
- 한계: 라이브러리가 말풍선 칸(50px)을 왼쪽(변경 전)에도 똑같이 만든다. 왼쪽은 빈 칸이라 가로 폭을 50px 더 쓴다. Diff 카드는 원래 카드 안 가로 스크롤(`overflow-x-auto`)이라 페이지가 밀리지는 않는다. 실제 모양은 아침에 눈으로 확인 필요.

### 9. 자동 갱신
- 계획: 조회용 Route Handler 2개(`/api/project/[id]/submissions`, `/api/project/[id]/submission/[sid]/review`, 둘 다 `findMember`+projectId 필터, `no-store`) →
  `lib/polling.ts`(포커스 복귀 + 15초, 숨은 탭에서 멈춤)와 `lib/activity.ts`(id 기준 합치기, 새 활동 판정, 상태 되돌림 방지)를 테스트와 함께 추가 → `ProjectWorkspace`/`ReviewProvider`에 연결, 새 항목 점 표시. 패턴: Slack 새 활동 점.
- 결정: 지시서는 "Server Actions 우선"이지만 폴링 조회는 Route Handler로 했다. Next 16 문서(07-mutating-data.md)에 Server Function은 한 번에 하나씩 순서대로 실행된다고 되어 있어, 최대 15초 걸리는 Comit과 폴링이 서로 막을 수 있기 때문.
- 확인 방법: 브라우저 두 개로 같은 프로젝트를 열고 한쪽에서 Comit/댓글 → 다른 쪽에 15초 안(또는 창을 다시 클릭하면 즉시)에 점과 함께 나타난다.
- 결과: 프로젝트 화면(목록)과 제출 상세(댓글+상태)가 포커스 복귀 시 즉시 + 15초마다 갱신. 새 제출/댓글 증가는 카드와 탭에 점+"새 활동", 새 댓글은 "새 댓글" 점+상단 "새 댓글 N개"(그 줄을 누르면 사라짐). 테스트 16개 추가(총 85개).
- 안전장치: 조회 결과는 id 기준으로 합쳐서 방금 내가 만든 항목이 사라지지 않게 했고, 상태는 PENDING에서만 바뀌게 해서 병합 직후 늦게 도착한 조회가 화면을 되돌리지 않는다. 다른 사람이 병합/충돌 처리하면 `router.refresh()`로 서버 값(최신 메인 코드)도 새로 받는다.
- 화면 점검(코드 기준): 점은 항상 글자("새 활동"/"새 댓글") 또는 sr-only 문구와 함께. 조회 실패(네트워크/404)는 조용히 넘기고 화면은 그대로(에러 상태).
- 비용 메모: 열려 있는(보이는) 탭 하나당 15초에 조회 1번(멤버 확인 + aggregate/find). 팀 프로젝트 규모에서는 문제없지만, 부담되면 `POLL_MS`를 늘리면 된다.
- 남긴 것: 에디터의 "원본(mainCode)"은 자동 갱신하지 않는다. 다른 병합이 생겨도 페이지를 새로 열기 전까지 에디터 기준은 그대로다(서버가 Comit 때 최신 원본으로 다시 비교하므로 데이터는 안전). 작성 중인 코드를 건드릴 위험이 있어 일부러 뺐다 → 아침에 결정 필요.

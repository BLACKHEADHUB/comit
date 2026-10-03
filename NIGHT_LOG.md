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
- [ ] 6. 목록을 할 일 기준 탭으로 (내가 리뷰할 것 / 내 제안 / 반영된 기록)
- [ ] 7. 진행 단계 바 (작성 → 제안함 → 리뷰 중 → 반영됨 + 다음 할 일)
- [ ] 8. 댓글을 코드 줄에 붙이기 (Diff 줄 옆 말풍선 마커)
- [ ] 9. 자동 갱신 (포커스 복귀 + 15초 폴링, 새 항목 점 표시)
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

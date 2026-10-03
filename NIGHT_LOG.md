# NIGHT_LOG

브랜치: `night/20261004` · 목표: "입문자가 지금 어디에 있고 다음에 뭘 해야 하는지 한눈에 아는 화면"

## 시작 점검 (2026-10-04)
- `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build` 모두 통과 확인.
- `app/invite/[token]/page.tsx`는 사용자가 수정 중인 파일 → 건드리지도 커밋하지도 않는다.
- 화면 용어는 기존 라벨 유지(지시서 기본값). 새 UI 문구만 "원본/다음 할 일" 말투 사용.
- 실제 DB/Gemini/Redis에 연결하지 않으므로 화면 점검(라이트/다크, 375px, 키보드)은 실제 렌더링이 아니라 코드 기준 점검이다.

## 백로그
- [x] 1. 안전망: Vitest 도입 + lib/validation.ts, lib/ai.ts, lib/draft.ts 단위 테스트
- [ ] 2. DESIGN_NOTES.md 작성: 현재 화면 문제점 + 서비스별 패턴 매핑
- [ ] 3. Comit 전 변경 미리보기 (미니 Diff + "원본에서 N줄 바뀜", 변경 없으면 제출 비활성)
- [ ] 4. 에디터에 원본과 달라진 줄 표시 (Monaco 색 띠 + 상단 요약)
- [ ] 5. 목록 카드 배지 (💬 댓글 수, 🐞 BUG 수, ⚠ AI 경고) — 서버 집계 쿼리 한 번
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

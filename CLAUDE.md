# Comit (코밋) — 프로젝트 가이드

## 서비스 개요
No-Terminal, Pure-Web! AI 중재자와 함께하는 초보자 전용 코드 협업 샌드박스.
Git/터미널 없이 웹에서 [코드 작성 → AI 요약/검토 → 원클릭 리뷰 → 안전한 병합]을 수행한다.
타깃: 코딩 입문자, 컴공 1~2학년, 비전공 대학생 팀 프로젝트.

## User Flow
1. 프로젝트 생성 → 공유 링크(난수 URL)로 팀원 초대
2. Monaco Editor로 코드 작성
3. [Comit하기] 버튼 → Submission 생성 (beforeCode = 당시 mainCode, afterCode = 수정본)
4. AI 분석 카드 자동 생성: 3줄 요약 / 보안·버그 경고 / 핵심 문법 개념 1문장
5. Diff View 원클릭 리뷰: 라인별 댓글 + 태그(LIKE 👍 / QUESTION ❓ / BUG 🐞)
6. 팀장이 병합 → mainCode 덮어쓰기, status = MERGED

## 기술 스택
- Next.js (App Router, TypeScript), Tailwind CSS
- @monaco-editor/react, react-diff-viewer-continued
- Server Actions 우선, 필요 시 Route Handlers
- MongoDB Atlas + Mongoose
- Google Gemini (Flash 계열, JSON 구조화 응답) — 모델명은 env `GEMINI_MODEL`로 관리
- Upstash Redis (Rate Limit + AI 결과 캐싱)
- 배포: Vercel

## DB 스키마
- Project: title, description, members[{ nickname, role: 'LEADER'|'MEMBER' }], mainCode, inviteToken, createdAt
- Submission: projectId, author, title, beforeCode, afterCode,
  aiReport{ summary: string[3], warning: string, concept: string },
  status('PENDING'|'MERGED'|'STALE'), createdAt
- Comment: submissionId, author, lineNumber, tag('LIKE'|'QUESTION'|'BUG'), content, createdAt

## 반드시 지킬 규칙
1. Monaco Editor / Diff Viewer는 `next/dynamic`으로 `ssr: false` 로드.
2. 병합은 조건부 원자적 업데이트로 처리:
   `Project.findOneAndUpdate({ _id, mainCode: submission.beforeCode }, { mainCode: afterCode })`
   결과가 null이면 충돌 → Submission을 STALE로 바꾸고 "최신 코드 기준으로 재제출" 안내.
3. AI 호출은 try-catch + 타임아웃. 실패 시 기본 텍스트 aiReport를 저장하고 흐름은 계속 진행.
   AI 응답 JSON은 zod로 검증한 뒤 저장.
4. 프롬프트에는 전체 코드가 아니라 diff 영역만 보낸다(토큰 절약).
5. 모든 쿼리는 projectId로 필터링(멀티테넌시 격리). 다른 프로젝트 데이터 접근 불가.
6. API 키 등 비밀값은 서버에서만 사용. 클라이언트 번들에 절대 노출 금지(NEXT_PUBLIC_ 금지).
7. 사용자 입력(제목, 댓글)은 길이 제한 + 검증. 코드는 실행하지 않고 텍스트로만 다룬다.

## 작업 방식
- 각 단계 시작 전 계획을 먼저 보여주고, 끝나면 무엇을 만들었는지와 실행/확인 방법을 요약할 것.
- 한 단계가 끝나기 전에 다음 단계 기능을 미리 만들지 말 것.
- 초보 개발자가 읽는 코드이므로 핵심 로직에 짧은 한국어 주석을 달 것.

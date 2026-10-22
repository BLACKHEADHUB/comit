# Comit 배포 체크리스트 (Vercel)

## 1. 배포 전에 꼭 할 일

- [ ] **`GEMINI_MODEL` 값 바꾸기** — 지금 로컬 `.env.local`의 `gemini-2.0-flash`는 Google이 종료해서 404가 납니다.
  - 확인 방법: 사용 중인 키로 `models.list`를 호출해 나온 이름 중 `generateContent`를 지원하는 Flash 계열을 고르세요.
  - 이 프로젝트에서 실제로 JSON 응답이 성공한 모델: `gemini-3.1-flash-lite` (2026-10 확인).
  - `gemini-3.8-flash`는 존재하지만 확인 시점에 과부하(503)가 잦았습니다. 모델은 시간이 지나면 또 종료될 수 있으니 주기적으로 확인하세요.
- [ ] **키/비밀번호 재발급** — 개발 중 `.env.local` 값이 에디터, 터미널, AI 도구의 대화 기록에 노출됐을 수 있습니다. 배포용으로는 새로 발급해서 쓰세요.
  - MongoDB Atlas: Database Access → 사용자 비밀번호 변경 (특수문자는 URL 인코딩, 예: `@` → `%40`. 영문+숫자만 쓰면 편해요)
  - Gemini: Google AI Studio → API keys → 새 키 발급 후 기존 키 삭제
  - Upstash: 콘솔 → 해당 DB → REST Token 재발급
- [ ] `git log -p`에 비밀값이 없는지 확인 (이 저장소는 점검 완료: `.env.local`은 `.gitignore`의 `.env*`로 제외되어 있고 커밋된 적 없음)

## 2. 환경변수 (Vercel → Project → Settings → Environment Variables)

모든 값은 **서버 전용**입니다. 이름에 `NEXT_PUBLIC_`을 붙이지 마세요 (붙이면 브라우저에 노출됩니다).

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `MONGODB_URI` | ✅ | `mongodb+srv://<user>:<인코딩된 비밀번호>@<cluster>.mongodb.net/comit?appName=Cluster0` (DB 이름은 `/comit`처럼 `?` 앞에) |
| `GEMINI_API_KEY` | ✅ | Google AI Studio 키 |
| `GEMINI_MODEL` | ✅ | 위 1번 참고. 비어 있으면 AI 분석은 항상 기본 문구로 대체됩니다 |
| `UPSTASH_REDIS_REST_URL` | 선택 | 비어 있으면 캐싱과 요청 제한이 꺼진 채로 정상 동작합니다 |
| `UPSTASH_REDIS_REST_TOKEN` | 선택 | 위와 같이 둘 다 있어야 켜집니다 |
| `CRON_SECRET` | 선택 | 임의의 긴 문자열. 설정하면 Vercel이 하루 한 번 `/api/cron/cleanup`을 호출해 오래 안 쓴 프로젝트를 점검합니다 |
| `CLEANUP_ENABLED` | 선택 | `true`일 때만 실제로 지웁니다. 비어 있으면 대상 개수만 로그에 남깁니다(먼저 로그로 확인하세요) |
| `PROJECT_EXPIRE_DAYS` | 선택 | 마지막 활동 후 정리까지의 일 수 (기본 90) |
| `SESSION_SECRET` | 권장 | 임의의 긴 문자열(예: `openssl rand -base64 32`). 멤버 쿠키 서명에 씁니다. 비어 있으면 `MONGODB_URI`로 대신 서명합니다. 이 값(또는 DB 주소)을 바꾸면 모두 복구 코드로 다시 들어와야 합니다 |
| `CONTACT_EMAIL` | 권장 | 약관·개인정보 처리방침·첫 화면 바닥글에 보이는 문의·신고 메일 |
| `OPERATOR_NAME` | 선택 | 약관에 표시할 운영자 이름 (기본 "Comit 운영팀") |
| `AI_DAILY_LIMIT` | 선택 | 프로젝트당 하루 AI 호출 한도 (기본 100). Upstash가 켜져 있어야 적용됩니다 |

- Production / Preview / Development 중 어디에 적용할지 선택하세요. Preview에는 운영 DB 대신 별도 DB를 쓰는 것을 권장합니다.
- 값을 바꾼 뒤에는 **다시 배포(Redeploy)** 해야 반영됩니다.

## 3. MongoDB Atlas 네트워크 접근

Vercel 서버리스 함수는 접속 IP가 고정되어 있지 않습니다.

- [ ] Atlas → Security → **Network Access** → `0.0.0.0/0` (Allow access from anywhere) 추가
  - IP 제한을 못 거는 대신 **강한 DB 비밀번호**가 유일한 방어선이 됩니다. 위 1번대로 새 비밀번호를 쓰세요.
  - 더 엄격하게 하려면 Vercel의 고정 IP 기능(유료) 또는 Atlas의 Vercel 마켓플레이스 연동을 검토하세요.
- [ ] Database Access의 사용자는 해당 DB(`comit`)에만 `readWrite` 권한을 주세요 (Atlas admin 계정 사용 금지).
- [ ] 이 앱은 병합 시 **트랜잭션**을 씁니다 → Atlas 클러스터(레플리카셋)에서만 동작합니다. 로컬 단독 mongod에는 쓸 수 없습니다.
- [ ] Vercel 함수 리전을 Atlas 클러스터와 가까운 곳으로 설정하면 응답이 빨라집니다.

## 4. Vercel 설정

1. GitHub에 저장소를 올리고 Vercel에서 **Import Project** (Framework: Next.js 자동 감지)
2. 위 환경변수 등록
3. Deploy
4. 최대 실행 시간: AI 분석을 기다리는 `[Comit하기]`는 최대 약 16초가 걸릴 수 있어 프로젝트 화면에 `maxDuration = 30`을 설정해 두었습니다. 요금제 한도에 걸리면 배포 로그에 표시되니 확인하세요.

## 5. 배포 후 확인 (스모크 테스트)

- [ ] 랜딩 → 프로젝트 생성 → 초대 링크가 **배포 도메인** 기준으로 나오는지
- [ ] 시크릿 창에서 초대 링크로 합류 → 팀원으로 표시되는지
- [ ] 코드 수정 후 Comit하기 → AI 분석 카드가 나오는지 (기본 문구만 나오면 Vercel 함수 로그에서 `[AI] 분석 실패 (status: …)` 확인)
- [ ] 라인 댓글 작성, 팀장 계정에서 병합 → 메인 코드 반영
- [ ] 같은 beforeCode의 제출 2개를 각각 병합 → 하나는 MERGED, 하나는 STALE
- [ ] (Upstash 설정 시) 같은 변경을 두 번 제출하면 두 번째는 로그에 AI 호출 없이 캐시로 처리되는지, 1분에 6번 제출하면 6번째에 "요청이 많아 잠시 후 다시 시도해주세요"가 나오는지

## 6. 알아둘 한계

- 약관(`/terms`)과 개인정보 처리방침(`/privacy`)은 기본 초안입니다. 공개 전에 운영자 이름·문의처를 채우고, 실제로 쓰는 서비스(Gemini 요금제의 데이터 사용 정책 등)와 맞는지 한 번 더 확인하세요.
- 멤버 쿠키는 서명돼 있어서, 이 기능 이전에 받은 쿠키(서명 없음)는 더 이상 통하지 않습니다. 기존 사용자는 복구 코드로 다시 들어오면 됩니다.

- 로그인이 없어서 사용자 식별은 **브라우저 쿠키(30일)** 입니다. 쿠키를 지우거나 다른 기기로 옮기면 멤버 권한을 잃고, 초대 링크를 다시 열어도 같은 닉네임은 중복으로 거절됩니다. (팀장 계정을 잃으면 병합을 못 하므로 정식 운영 전에 로그인 도입을 권장합니다.)
- 초대 링크를 아는 사람은 누구나 참여할 수 있습니다. 링크는 팀원에게만 공유하세요.

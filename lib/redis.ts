import "server-only";
import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { aiReportSchema, type AIReport } from "@/lib/ai";

// UPSTASH 환경변수가 비어 있으면 redis는 null → 캐시와 제한을 건너뛰고 앱은 정상 동작한다
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// 주소 형식이 잘못되면(예: https://가 빠짐) Redis 생성이 UrlError를 던져 이 모듈을 못 불러온다.
// 그래도 앱이 멈추지 않게 에러는 로그만 남기고 Redis 없이 계속 진행한다
function createRedis(): Redis | null {
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch (error) {
    console.error("[Redis] 연결 설정 실패 — UPSTASH_REDIS_REST_URL 값을 확인하세요:", error instanceof Error ? error.name : "unknown");
    return null;
  }
}
const redis = createRedis();

// 프로젝트+작성자 기준 분당 5회 (sliding window)
const aiRateLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 m"), prefix: "comit:ai" })
  : null;

// 프로젝트별 하루 AI 호출 한도 (Gemini 비용 폭주 방지). env AI_DAILY_LIMIT로 조절한다
const aiDailyLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(Number(process.env.AI_DAILY_LIMIT) || 100, "1 d"),
      prefix: "comit:ai-daily",
    })
  : null;

// 제출(Comit하기): 프로젝트+작성자 기준 분당 10회 → 도배로 DB가 차는 것을 막는다
const submitRateLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "comit:submit" })
  : null;

// 프로젝트 생성: IP 기준 시간당 10개
const createProjectRateLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 h"), prefix: "comit:create" })
  : null;

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24시간

// Redis 장애가 제출 흐름을 막지 않도록 에러는 로그만 남기고 계속 진행한다 (비밀값이 섞이지 않게 메시지만 기록)
const logRedisError = (what: string, error: unknown) =>
  console.error(`[Redis] ${what} 실패:`, error instanceof Error ? error.message.slice(0, 200) : "unknown");

// true = 호출 허용. Redis가 없거나 장애면 제한 없이 허용한다
export async function allowAiCall(projectId: string, author: string): Promise<boolean> {
  if (!aiRateLimit || !aiDailyLimit) return true;
  try {
    const { success } = await aiRateLimit.limit(`${projectId}:${author}`);
    if (!success) return false;
    // 분당 한도를 통과한 호출만 하루 한도(프로젝트 전체)를 소모한다
    return (await aiDailyLimit.limit(projectId)).success;
  } catch (error) {
    logRedisError("rate limit", error);
    return true;
  }
}

// 같은 모양의 제한 확인: Redis가 없거나 장애면 허용한다
async function checkLimit(limiter: Ratelimit | null, key: string, what: string): Promise<boolean> {
  if (!limiter) return true;
  try {
    return (await limiter.limit(key)).success;
  } catch (error) {
    logRedisError(what, error);
    return true;
  }
}

export const allowSubmit = (projectId: string, author: string) => checkLimit(submitRateLimit, `${projectId}:${author}`, "제출 제한");
export const allowCreateProject = (ip: string) => checkLimit(createProjectRateLimit, ip, "프로젝트 생성 제한");

// 캐시 키: diff 내용의 SHA-256 (같은 변경이면 같은 키)
// v2: 프롬프트를 바꿨을 때 이전 프롬프트로 만든 캐시가 재사용되지 않도록 버전을 키에 포함한다
export const cacheKeyForDiff = (diff: string) => `comit:ai:v2:${createHash("sha256").update(diff).digest("hex")}`;

export async function getCachedReport(key: string): Promise<AIReport | null> {
  if (!redis) return null;
  try {
    const parsed = aiReportSchema.safeParse(await redis.get(key)); // 캐시 값도 믿지 않고 다시 검증
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logRedisError("캐시 조회", error);
    return null;
  }
}

export async function setCachedReport(key: string, report: AIReport): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, report, { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    logRedisError("캐시 저장", error);
  }
}

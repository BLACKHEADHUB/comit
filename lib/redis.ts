import "server-only";
import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { aiReportSchema, type AIReport } from "@/lib/ai";

// UPSTASH 환경변수가 비어 있으면 redis는 null → 캐시와 제한을 건너뛰고 앱은 정상 동작한다
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// 프로젝트+작성자 기준 분당 5회 (sliding window)
const aiRateLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 m"), prefix: "comit:ai" })
  : null;

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24시간

// Redis 장애가 제출 흐름을 막지 않도록 에러는 로그만 남기고 계속 진행한다 (비밀값이 섞이지 않게 메시지만 기록)
const logRedisError = (what: string, error: unknown) =>
  console.error(`[Redis] ${what} 실패:`, error instanceof Error ? error.message.slice(0, 200) : "unknown");

// true = 호출 허용. Redis가 없거나 장애면 제한 없이 허용한다
export async function allowAiCall(projectId: string, author: string): Promise<boolean> {
  if (!aiRateLimit) return true;
  try {
    const { success } = await aiRateLimit.limit(`${projectId}:${author}`);
    return success;
  } catch (error) {
    logRedisError("rate limit", error);
    return true;
  }
}

// 캐시 키: diff 내용의 SHA-256 (같은 변경이면 같은 키)
export const cacheKeyForDiff = (diff: string) => `comit:ai:${createHash("sha256").update(diff).digest("hex")}`;

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

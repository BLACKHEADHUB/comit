// `npm run e2e`: 실제 서비스(Atlas, Gemini, Upstash)에 닿지 않는 격리된 환경에서 앱을 띄우고 Playwright 시나리오를 돌린다.
// 1) 메모리 MongoDB(레플리카셋: 병합 트랜잭션에 필요) 시작
// 2) 환경변수를 명시적으로 덮어쓰고, 정말 덮어써졌는지 사전 확인 (실패하면 앱을 띄우지 않는다)
// 3) next build → next start
// 4) playwright test
import { spawn, spawnSync } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
// 1노드 레플리카셋에서 SDAM 서버 선택 타임아웃을 막기 위해 directConnection=true를 명시한다.
const mongoUrl = new URL(replSet.getUri("comit_e2e"));
mongoUrl.searchParams.set("directConnection", "true");
const mongoUri = mongoUrl.toString();

// .env.local에 실제 값이 있어도 이 값들이 이긴다 (Next는 이미 정의된 환경변수를 .env 파일로 덮어쓰지 않는다. 빈 문자열도 "정의됨")
const env = {
  ...process.env,
  NODE_ENV: "production",
  MONGODB_URI: mongoUri,
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  E2E_BASE_URL: BASE_URL,
  E2E_MONGO_URI: mongoUri,
};

let server;
async function cleanup() {
  server?.kill("SIGTERM");
  await replSet.stop();
}

function fail(message) {
  console.error(`\n[e2e] 중단: ${message}`);
  return cleanup().then(() => process.exit(1));
}

// 사전 확인: Next가 쓰는 것과 같은 env 로더를 같은 조건으로 돌려 본다. 값은 출력하지 않고 참/거짓만 본다
const preflight = spawnSync(
  process.execPath,
  [
    "-e",
    `const { loadEnvConfig } = require("@next/env");
     loadEnvConfig(process.cwd(), false);
     const ok = {
       mongoIsLocal: (process.env.MONGODB_URI || "").startsWith("mongodb://127.0.0.1"),
       geminiKeyEmpty: !process.env.GEMINI_API_KEY,
       geminiModelEmpty: !process.env.GEMINI_MODEL,
       redisUrlEmpty: !process.env.UPSTASH_REDIS_REST_URL,
       redisTokenEmpty: !process.env.UPSTASH_REDIS_REST_TOKEN,
     };
     console.log(JSON.stringify(ok));
     process.exit(Object.values(ok).every(Boolean) ? 0 : 1);`,
  ],
  { env, encoding: "utf8" }
);
console.log(`[e2e] 환경변수 사전 확인: ${preflight.stdout.trim()}`);
if (preflight.status !== 0) await fail("환경변수가 덮어써지지 않았어요. 실제 서비스에 연결될 수 있어 앱을 띄우지 않습니다.");

const run = (cmd, args) => spawnSync(cmd, args, { env, stdio: "inherit" });

if (!process.argv.includes("--skip-build")) {
  console.log("[e2e] next build ...");
  if (run("npx", ["next", "build"]).status !== 0) await fail("빌드 실패");
}

server = spawn("npx", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], { env, stdio: ["ignore", "ignore", "inherit"] });

// 서버가 응답할 때까지 최대 60초 기다린다
let ready = false;
for (let i = 0; i < 120 && !ready; i++) {
  try {
    ready = (await fetch(BASE_URL)).ok;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!ready) await fail("서버가 뜨지 않았어요.");

const extraArgs = process.argv.slice(2).filter((a) => a !== "--skip-build");
const result = run("npx", ["playwright", "test", "-c", "e2e/playwright.config.ts", ...extraArgs]);

await cleanup();
process.exit(result.status ?? 1);

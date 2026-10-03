import { defineConfig } from "@playwright/test";

// `npm run e2e`(e2e/run.mjs)가 메모리 DB와 앱을 띄운 뒤 이 설정으로 테스트를 실행한다.
// 직접 `npx playwright test`로 돌리면 서버가 없어서 실패한다 (실수로 다른 서버에 붙지 않게 baseURL을 고정하지 않는다)
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts", // e2e 폴더 바로 아래의 시나리오만 (스크린샷 폴더 안의 임시 파일은 테스트로 보지 않는다)
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    actionTimeout: 15_000, // 못 찾는 요소를 2분씩 기다리지 않게
  },
  projects: [
    // 가장 먼저: 실제 서비스가 아니라 메모리 DB/빈 AI 키로 돌고 있는지 확인. 실패하면 나머지는 실행되지 않는다
    { name: "safety", testMatch: "safety.spec.ts", use: { viewport: { width: 1280, height: 800 } } },
    {
      name: "desktop-light",
      testIgnore: "safety.spec.ts",
      dependencies: ["safety"],
      use: { viewport: { width: 1280, height: 800 }, colorScheme: "light" },
    },
    {
      name: "desktop-dark",
      testIgnore: "safety.spec.ts",
      dependencies: ["safety"],
      use: { viewport: { width: 1280, height: 800 }, colorScheme: "dark" },
    },
    {
      name: "mobile",
      testIgnore: "safety.spec.ts",
      dependencies: ["safety"],
      use: { viewport: { width: 375, height: 812 }, colorScheme: "light", hasTouch: true },
    },
  ],
});

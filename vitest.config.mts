import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // "server-only"는 Next 빌드 밖에서 import하면 에러를 던지므로 테스트에서는 빈 모듈로 바꾼다
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});

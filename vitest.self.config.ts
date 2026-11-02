import { defineConfig } from "vitest/config";

/** Конфиг self-scan: поднимает локальную страницу и гоняет по ней runScan. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/self-scan.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});

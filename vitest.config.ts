import { defineConfig } from "vitest/config";

/**
 * Юнит-тесты ядра (tests/*.test.ts), отчётной логики (tests/report/*.test.ts),
 * нативных проверок (tests/native/*.test.ts) и CLI (tests/cli/*.test.ts):
 * фикстуры и моки, без сети и браузера.
 * Self-scan (tests/self-scan.test.ts) гоняется отдельно: npm run scan:self.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/*.test.ts",
      "tests/report/*.test.ts",
      "tests/native/*.test.ts",
      "tests/cli/*.test.ts",
    ],
    exclude: ["tests/self-scan.test.ts"],
  },
});

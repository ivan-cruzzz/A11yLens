import { defineConfig } from "vitest/config";

/**
 * Юнит-тесты ядра (tests/*.test.ts): фикстуры и моки, без сети и браузера.
 * Self-scan (tests/self-scan.test.ts) гоняется отдельно: npm run scan:self.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/*.test.ts"],
    exclude: ["tests/self-scan.test.ts"],
  },
});

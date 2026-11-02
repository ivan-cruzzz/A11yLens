import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Юнит-тесты десктопа: чистые модули UI-слоя (конфиг режимов, сборка аргументов
 * sidecar, разбор вывода движка, оценка полноты отчёта, slim-срез, история).
 * Сеть и sidecar не запускаются — проверяются только швы десктопа.
 * Запуск из корня репозитория: npx vitest run --config desktop/vitest.config.mts
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    environment: "node",
    include: ["src/lib/*.test.ts"],
  },
});

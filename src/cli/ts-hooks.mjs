// Резолв-хук для запуска .ts без сборки: "./render" → "./render.ts".
// Загрузка и снятие типов выполняются самим Node (type stripping).

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, next) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[cm]?[jt]s$/i.test(specifier) &&
    !specifier.endsWith(".json")
  ) {
    const base = new URL(specifier, context.parentURL).href;
    for (const suffix of [".ts", "/index.ts"]) {
      if (existsSync(fileURLToPath(base + suffix))) {
        return next(specifier + suffix, context);
      }
    }
  }
  return next(specifier, context);
}

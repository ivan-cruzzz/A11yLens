#!/usr/bin/env node
// Ланчер CLI без сборки: Node ≥ 22.6 сам снимает типы с .ts-файлов,
// а хук ниже добавляет разрешение расширений .ts в import-спецификаторах
// (Node-ESM сам по себе требует явных расширений).

import { register } from "node:module";

register(new URL("./ts-hooks.mjs", import.meta.url));

await import("./main.ts");

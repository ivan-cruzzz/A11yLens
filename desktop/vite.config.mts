import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Корень — каталог desktop/, фронт собирается в dist/, который tauri.conf.json
// указывает как frontendDist.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  clearScreen: false,
  build: {
    outDir: "dist",
    target: "chrome110",
  },
});

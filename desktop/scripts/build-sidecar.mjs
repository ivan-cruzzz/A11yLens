/**
 * Сборка Node SEA-бинарника a11ylens-engine.exe (sidecar десктопа):
 *
 *   1. esbuild бандлит desktop/sidecar/engine-main.mjs (CLI-движок целиком,
 *      включая playwright-core) в CJS — SEA исполняет именно такой скрипт.
 *   2. node --sea-config → sea-prep.blob.
 *   3. Копия node.exe → a11ylens-engine.exe.
 *   4. postject вшивает blob и ставит sentinel-fuse.
 *   5. Результат кладётся в src-tauri/binaries/a11ylens-engine-<triple>.exe —
 *      ровно то, что ожидает bundle.externalBin из tauri.conf.json.
 *
 * Запуск: npm run build:sidecar (из desktop/) или node scripts/build-sidecar.mjs.
 * Требования: Node >= 22.6 (SEA + type-stripping для исходников), esbuild,
 * postject (обе зависимости — devDependencies desktop/package.json; в этом
 * репозитории esbuild также доступен из корневых node_modules через vite).
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sidecarDir = path.join(desktopDir, "sidecar");
const binariesDir = path.join(desktopDir, "src-tauri", "binaries");

const require = createRequire(import.meta.url);

/** esbuild: сначала из node_modules десктопа, затем из корня репозитория. */
function resolveEsbuild() {
  try {
    return require(desktopDir + "/node_modules/esbuild");
  } catch {
    return require("esbuild");
  }
}

function nodeMinVersion(minimum) {
  const [major] = process.versions.node.split(".").map(Number);
  return major >= minimum;
}

async function main() {
  if (!nodeMinVersion(22)) {
    throw new Error(`Нужен Node >= 22, сейчас ${process.versions.node}`);
  }

  mkdirSync(binariesDir, { recursive: true });

  // ── 1. Бандл ──
  const esbuild = resolveEsbuild();
  const repoDir = path.resolve(desktopDir, "..");
  const bundlePath = path.join(sidecarDir, "engine-bundle.cjs");
  await esbuild.build({
    entryPoints: [path.join(sidecarDir, "engine-main.mjs")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    outfile: bundlePath,
    minify: false,
    sourcemap: false,
    logLevel: "info",
    // node:* встроенные остаются внешними (SEA-рантайм их предоставляет).
    packages: "bundle",
    alias: {
      // "cli.js" нет в exports-карте playwright-core — подключаем по файлу.
      "playwright-core/cli.js": path.join(repoDir, "node_modules", "playwright-core", "cli.js"),
    },
    // chromium-bidi playwright требует лениво и только для BiDi-подключений;
    // в chromium-CDP-потоке десктопа путь не выполняется. Пакет опционален
    // и может быть не установлен — поэтому внешний.
    external: ["chromium-bidi"],
  });

  // Playwright вычисляет корень своего пакета как dirname("..") — в бандле это
  // ломается, а в SEA require() разрешён только для встроенных модулей.
  // Патчим три точки:
  //   A. packageRoot: env A11YLENS_PW_HOME → каталог pw/ рядом с бандлом/exe
  //      (файлы кладут ресурсы установщика) → fallback __dirname; browsers.json
  //      читается fs.readFileSync в globalThis.__a11yPwBrowsers;
  //   B. package.json — заглушка (нужна только для версии);
  //   C. Registry получает уже прочитанный browsers.json.
  const originalInit = 'packageRoot = import_path8.default.join(__dirname, "..");';
  const patchedInit =
    'packageRoot = process.env.A11YLENS_PW_HOME || ' +
    '(require("fs").existsSync(require("path").join(__dirname, "pw", "browsers.json")) ' +
    '? require("path").join(__dirname, "pw") : __dirname); ' +
    'try { globalThis.__a11yPwBrowsers = JSON.parse(require("fs").readFileSync(' +
    'require("path").join(__dirname, "pw", "browsers.json"), "utf8")); } catch (e) {}';
  const originalPackageJson =
    'packageJSON = require(import_path8.default.join(packageRoot, "package.json"));';
  const patchedPackageJson =
    'packageJSON = { name: "playwright-core", version: "0.0.0-bundled" };';
  const originalRegistry =
    'registry = new Registry(require(import_path19.default.join(packageRoot, "browsers.json")));';
  const patchedRegistry =
    'registry = new Registry(globalThis.__a11yPwBrowsers ?? require(import_path19.default.join(packageRoot, "browsers.json")));';
  // D. Докачка браузера: playwright скачивает через fork отдельного файла
  // (lib/entry/oopBrowserDownload.js) — в SEA файла нет, а fork исполнил бы
  // встроенный скрипт. Hoisted-функция main() делает то же самое
  // (downloadFile + extractZip + маркер INSTALLATION_COMPLETE) в этом же
  // процессе — вызываем её напрямую.
  const originalFork =
    'const cp = childProcess3.fork(libPath("entry", "oopBrowserDownload.js"));';
  const patchedFork =
    'return main({ title, browserDirectory, url: url3, zipPath, executablePath, socketTimeout, userAgent: "a11ylens-engine" })' +
    '.then(() => ({ error: null }), (error2) => ({ error: error2 }));\n      const cp = childProcess3.fork(libPath("entry", "oopBrowserDownload.js"));';

  let bundleSource = readFileSync(bundlePath, "utf8");
  for (const [original, patched] of [
    [originalInit, patchedInit],
    [originalPackageJson, patchedPackageJson],
    [originalRegistry, patchedRegistry],
    [originalFork, patchedFork],
  ]) {
    if (!bundleSource.includes(original)) {
      throw new Error(
        `Не найден фрагмент для патча (${original.slice(0, 60)}…) — playwright-core обновился, поправьте build-sidecar.mjs`
      );
    }
    bundleSource = bundleSource.replace(original, patched);
  }
  writeFileSync(bundlePath, bundleSource);
  console.log("[1/4] Патчи packageRoot/package.json/browsers.json применены");

  // Каталог pw/ (browsers.json + package.json) — рядом с бандлом для локального
  // запуска и в ресурсах Tauri для установщика (см. tauri.conf.json resources).
  const pwCoreDir = path.join(repoDir, "node_modules", "playwright-core");
  const pwHome = path.join(sidecarDir, "pw");
  mkdirSync(pwHome, { recursive: true });
  for (const file of ["browsers.json", "package.json"]) {
    copyFileSync(path.join(pwCoreDir, file), path.join(pwHome, file));
  }
  mkdirSync(path.join(binariesDir, "pw"), { recursive: true });
  for (const file of ["browsers.json", "package.json"]) {
    copyFileSync(path.join(pwCoreDir, file), path.join(binariesDir, "pw", file));
  }
  console.log(`[1/4] Бандл готов: ${bundlePath}`);

  // Дымовая проверка бандла до вшивания: usage должен работать, модуль
  // Playwright — загрузиться (домашний каталог pw через env).
  execFileSync(process.execPath, [bundlePath], {
    stdio: "inherit",
    encoding: "utf8",
    env: {
      ...process.env,
      A11YLENS_PW_HOME: path.join(repoDir, "node_modules", "playwright-core"),
    },
  });
  console.log("[2/4] Дымовая проверка бандла прошла");

  // ── 2. Blob ──
  const seaConfigPath = path.join(sidecarDir, "sea-config.json");
  rmSync(path.join(sidecarDir, "sea-prep.blob"), { force: true });
  execFileSync(process.execPath, ["--experimental-sea-config", seaConfigPath], { cwd: sidecarDir, stdio: "inherit" });
  console.log("[2/4] SEA-blob готов");

  // ── 3. Копия node.exe ──
  const triple = targetTriple();
  const engineName = `a11ylens-engine-${triple}${path.extname(process.execPath)}`;
  const enginePath = path.join(binariesDir, engineName);
  copyFileSync(process.execPath, enginePath);
  console.log(`[3/4] node.exe скопирован: ${enginePath}`);

  // ── 4. postject: вшиваем blob и включаем sentinel-fuse ──
  const postject = resolveOptionalPostject();
  const blobBuffer = readFileSync(path.join(sidecarDir, "sea-prep.blob"));
  await postject.inject(
    enginePath,
    "NODE_SEA_BLOB",
    blobBuffer,
    {
      machoFuse: "",
      sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    }
  );
  console.log(`[4/4] Готово: ${enginePath}`);
  console.log("Положите/пересоберите tauri-bundle — externalBin найдёт бинарник по имени.");
}

function resolveOptionalPostject() {
  try {
    return require(desktopDir + "/node_modules/postject");
  } catch {
    return require("postject");
  }
}

/** Rust-тройка таргета — ровно то, что ожидает bundle.externalBin в Tauri. */
function targetTriple() {
  if (process.env.A11YLENS_TARGET_TRIPLE) {
    return process.env.A11YLENS_TARGET_TRIPLE;
  }
  const arch = { arm64: "aarch64", x64: "x86_64" }[os.arch()] ?? os.arch();
  if (process.platform === "win32") {
    return `${arch}-pc-windows-msvc`;
  }
  if (process.platform === "darwin") {
    return `${arch}-apple-darwin`;
  }
  return `${arch}-unknown-linux-gnu`;
}

main().catch((error) => {
  console.error(`Сборка sidecar не удалась: ${error?.message ?? error}`);
  console.error(
    "Подсказка: npm install внутри desktop/ (нужны esbuild и postject), Node >= 22.6.\n" +
      "Приложение работает и без SEA-бинарника в dev-режиме: node src/cli/bin.mjs (см. README)."
  );
  process.exit(1);
});

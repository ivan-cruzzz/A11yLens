/**
 * Точка входа sidecar-движка десктопа (Node SEA-бинарник a11ylens-engine.exe).
 *
 * Подкоманды:
 *   a11ylens-engine scan <url> [--json] [--mode quick|normal|deep]
 *       [--max-pages N] [--timeout ms] [--security-only] [--a11y-only]
 *   a11ylens-engine install-browser — докачка Playwright-Chromium
 *       с официального CDN (запускается только по согласию пользователя,
 *       гейт — экран первого запуска окна).
 *
 * Импортируем scan-command напрямую (без main.ts: у него top-level await,
 * который не выражается в CJS-бандле для SEA). Флаги разбирает локальный
 * парсер — ровно тот набор, что окно передаёт движку.
 */

import { runScanCommand } from "../../src/cli/scan-command.ts";

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "install-browser") {
    // Официальный установщик Playwright: качает Chromium в %LOCALAPPDATA%\ms-playwright.
    process.argv = [process.argv[0], "a11ylens-engine", "install", "chromium"];
    await import("playwright-core/cli.js");
  } else if (command === "scan") {
    const url = args[1] ?? "";
    process.exitCode = await runScanCommand(url, parseFlags(args.slice(2)));
  } else {
    process.stdout.write(
      [
        "A11yLens Engine — CLI-движок десктоп-приложения (sidecar)",
        "",
        "Использование:",
        "  a11ylens-engine scan <url> [--json] [--mode quick|normal|deep] [--max-pages N] [--timeout ms]",
        "  a11ylens-engine install-browser",
        "",
      ].join("\n")
    );
    process.exitCode = command === undefined ? 0 : 2;
  }
}

/** Парсер флагов скана — тот же набор, что у CLI (ScanFlags). */
function parseFlags(flags) {
  const parsed = {};
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index];
    switch (flag) {
      case "--json":
        parsed.json = true;
        break;
      case "--csv":
        parsed.csv = true;
        break;
      case "--security-only":
        parsed.securityOnly = true;
        break;
      case "--a11y-only":
        parsed.a11yOnly = true;
        break;
      case "--max-pages":
        index += 1;
        parsed.maxPages = positiveInt(flags[index]);
        break;
      case "--timeout":
        index += 1;
        parsed.timeout = positiveInt(flags[index]);
        break;
      case "--fail-under":
        index += 1;
        parsed.failUnder = positiveInt(flags[index]);
        break;
      case "--mode":
        index += 1;
        if (flags[index] !== "quick" && flags[index] !== "normal" && flags[index] !== "deep") {
          process.stderr.write("Режим: quick | normal | deep\n");
          process.exitCode = 2;
          return parsed;
        }
        parsed.mode = flags[index];
        break;
      default:
        process.stderr.write(`Неизвестный флаг: ${flag}\n`);
        process.exitCode = 2;
        return parsed;
    }
  }
  return parsed;
}

function positiveInt(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Ожидалось целое положительное число, получено: ${raw}`);
  }
  return value;
}

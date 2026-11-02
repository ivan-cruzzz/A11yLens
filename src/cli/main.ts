/**
 * Точка входа CLI `a11ylens`. Разбор флагов — commander, раскраска —
 * picocolors внутри рендера. Коды выхода: 0 успех, 1 ниже порога, 2 ошибка.
 */

import { Command, InvalidArgumentError } from "commander";
import { runScanCommand } from "./scan-command";
import type { ScanFlags } from "./scan-command";
import type { NativeScanMode } from "../engine/native";

const positiveInt = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("Ожидалось целое положительное число");
  }
  return parsed;
};

const modeChoice = (value: string): NativeScanMode => {
  if (value !== "quick" && value !== "normal" && value !== "deep") {
    throw new InvalidArgumentError("Режим: quick | normal | deep");
  }
  return value;
};

const program = new Command();

program
  .name("a11ylens")
  .description(
    "A11yLens — доступность (WCAG) и безопасность сайта из терминала: скор, находки, план исправления"
  )
  .version("0.1.0");

program
  .command("scan")
  .description("Сканировать сайт и напечатать отчёт")
  .argument("<url>", "адрес страницы, например example.com")
  .option("--json", "машиночитаемый вывод: JSON со scan и native", false)
  .option("--csv", "машиночитаемый вывод: CSV-таблица находок", false)
  .option("--security-only", "только проверки безопасности, без доступности", false)
  .option("--a11y-only", "только доступность, без проверок безопасности", false)
  .option("--max-pages <n>", "сколько страниц сканировать (1–10)", positiveInt)
  .option("--timeout <ms>", "общий лимит времени на скан в миллисекундах", positiveInt)
  .option(
    "--fail-under <n>",
    "код выхода 1, если худший из показанных скоров ниже порога (0–100)",
    positiveInt
  )
  .option("--mode <mode>", "интенсивность нативных проверок: quick | normal | deep", modeChoice)
  .addHelpText(
    "after",
    "\nКоды выхода: 0 — успешно; 1 — скор ниже --fail-under; 2 — ошибка (сайт недоступен, нет браузера).\nЕсли скан падает с сообщением про браузер: npx playwright install chromium"
  )
  .action(async (url: string, options: Record<string, unknown>) => {
    const flags: ScanFlags = {
      json: options.json === true,
      csv: options.csv === true,
      securityOnly: options.securityOnly === true,
      a11yOnly: options.a11yOnly === true,
      maxPages: options.maxPages as number | undefined,
      timeout: options.timeout as number | undefined,
      failUnder: options.failUnder as number | undefined,
      mode: options.mode as NativeScanMode | undefined,
    };
    process.exitCode = await runScanCommand(url, flags);
  });

await program.parseAsync(process.argv);

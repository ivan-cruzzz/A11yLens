/**
 * Команда `a11ylens scan <url>`: запускает движок (доступность + браузерный
 * security) и нативный аудит параллельно, рендерит отчёт и возвращает
 * exit code: 0 — успешно, 1 — скор ниже --fail-under, 2 — ошибка скана.
 * Все сканеры инъектируются — тесты идут без сети и без браузера.
 */

import { runScan, type ScanOptions } from "../engine";
import type { ScanResult } from "../engine/types";
import { withTimeout } from "../engine/timeout";
import { normalizeUrl } from "../engine/url-guard";
import { runNativeAudit } from "../engine/native";
import type { NativeReport, NativeScanMode } from "../engine/native";
import { renderReport } from "./render";
import { buildCsv } from "./csv";

export const PLAYWRIGHT_HINT =
  "Браузер для сканирования не установлен. Выполните команду: npx playwright install chromium";

const DEFAULT_TIMEOUT_MS = 60_000;

export interface ScanFlags {
  json?: boolean;
  csv?: boolean;
  securityOnly?: boolean;
  a11yOnly?: boolean;
  maxPages?: number;
  /** Общий лимит времени на скан, мс. */
  timeout?: number;
  /** Exit code 1, если худший из показанных скоров ниже порога. */
  failUnder?: number;
  mode?: NativeScanMode;
}

export interface ScanCommandDeps {
  runScan?: (options: ScanOptions) => Promise<ScanResult>;
  runNativeAudit?: (url: string, mode: NativeScanMode) => Promise<NativeReport>;
  writeOut?: (text: string) => void;
  writeErr?: (text: string) => void;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Playwright без скачанных браузеров даёт характерное сообщение при launch. */
export function isPlaywrightMissingError(error: unknown): boolean {
  return /Executable doesn't exist|browserType\.launch|Playwright was just installed|npx playwright install/i.test(
    messageOf(error)
  );
}

/** Понятная причина вместо сырого сетевого текста (R03.3). */
export function describeScanError(error: unknown): string {
  const message = messageOf(error);
  if (message.startsWith("Скан не уложился")) {
    return message;
  }
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(message)) {
    return "Сайт не открылся: домен не найден (DNS). Проверьте адрес и DNS-записи домена.";
  }
  if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(message)) {
    return "Сайт не открылся: соединение отклонено. Проверьте, что сервер отвечает.";
  }
  if (/ERR_CONNECTION_RESET|ECONNRESET|socket hang up/i.test(message)) {
    return "Сайт не открылся: соединение разорвано на середине ответа.";
  }
  if (/timed out|timeout|ETIMEDOUT|abort/i.test(message)) {
    return "Сайт не открылся: превышено время ожидания ответа.";
  }
  return `Ошибка сканирования: ${message}`;
}

export async function runScanCommand(
  url: string,
  flags: ScanFlags = {},
  deps: ScanCommandDeps = {}
): Promise<number> {
  const writeOut = deps.writeOut ?? ((text: string) => process.stdout.write(text));
  const writeErr = deps.writeErr ?? ((text: string) => process.stderr.write(text));
  const doRunScan = deps.runScan ?? runScan;
  const doNativeAudit = deps.runNativeAudit ?? runNativeAudit;

  let target: string;
  try {
    target = normalizeUrl(url);
  } catch (error) {
    writeErr(`${messageOf(error)}\n`);
    return 2;
  }

  const showA11y = !flags.securityOnly;
  const showSecurity = !flags.a11yOnly;
  const timeoutMs = flags.timeout ?? DEFAULT_TIMEOUT_MS;
  const mode = flags.mode ?? "normal";

  // maxPages приходит из CLI (--max-pages) и уходит в движок; в текущей
  // версии ScanOptions поля может не быть — передаём совместимым объектом.
  const scanOptions = {
    url: target,
    standard: "AA",
    device: "desktop",
    ...(flags.maxPages ? { maxPages: flags.maxPages } : {}),
  } as ScanOptions;

  try {
    // Браузерный скан идёт всегда: он даёт и доступность, и browser-security
    // (отключить axe внутри runScan нельзя). Флаги --security-only/--a11y-only
    // управляют отображением секций и запуском нативного аудита.
    const [result, native] = await Promise.all([
      withTimeout(
        doRunScan(scanOptions),
        timeoutMs,
        `Скан не уложился в --timeout ${timeoutMs} мс — увеличьте лимит или проверьте сеть`
      ),
      showSecurity ? doNativeAudit(target, mode) : Promise.resolve(null),
    ]);

    if (flags.json) {
      writeOut(`${JSON.stringify({ scan: result, native }, null, 2)}\n`);
    } else if (flags.csv) {
      writeOut(buildCsv(result, native, showA11y, showSecurity));
    } else {
      writeOut(renderReport({ result, native, showA11y, showSecurity }));
    }

    if (flags.failUnder != null) {
      const scores: number[] = [];
      if (result && showA11y) {
        scores.push(result.score);
      }
      if (result?.security && showSecurity) {
        scores.push(result.security.score);
      }
      if (native && showSecurity && !native.error) {
        scores.push(native.score);
      }
      if (scores.length > 0 && Math.min(...scores) < flags.failUnder) {
        return 1;
      }
    }
    return 0;
  } catch (error) {
    if (isPlaywrightMissingError(error)) {
      // Ровно одна подсказка с готовой командой установки (G01.2).
      writeErr(`${PLAYWRIGHT_HINT}\n`);
      return 2;
    }
    writeErr(`${describeScanError(error)}\n`);
    return 2;
  }
}

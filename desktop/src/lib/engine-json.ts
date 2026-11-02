import type { EngineReport } from "./report-types";

/**
 * Разбор stdout sidecar (`--json`). Любой мусор — null: обрыв процесса,
 * попадание stderr в stdout, частичная печать. null = отчёта нет,
 * попытка помечается неполной (R04.3).
 */
export function parseEngineOutput(stdout: string): EngineReport | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (!("scan" in record) || typeof record.scan !== "object" || record.scan === null) {
    return null;
  }
  return parsed as EngineReport;
}

/** Playwright без скачанного Chromium даёт характерные сообщения при launch. */
export function isPlaywrightMissing(stderr: string): boolean {
  return /Executable doesn't exist|browserType\.launch|Playwright was just installed|npx playwright install/i.test(
    stderr
  );
}

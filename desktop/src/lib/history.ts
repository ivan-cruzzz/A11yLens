import type { EngineReport, ScanResult } from "./report-types";
import { toSlimReport } from "./slim";

/**
 * Локальная история сканов десктопа. Хранится в файле app data
 * (через команду Tauri load_history/save_history) — НЕ в localStorage:
 * она должна переживать обновления и работать без профиля WebView.
 * Тяжёлые поля (скриншоты) перед сохранением срезает toSlimReport.
 */

export const MAX_HISTORY = 50;

export interface HistoryEntry {
  id: string;
  url: string;
  host: string;
  mode: "quick" | "normal" | "deep";
  scannedAt: string;
  complete: boolean;
  pagesDone: number;
  pagesPlanned: number;
  scores: {
    a11y: number | null;
    security: number | null;
    native: number | null;
  };
  /** Slim-отчёт для повторного просмотра; null — только сводка (обрыв). */
  report: ScanResult | null;
}

/** Новая запись сверху, история ограничена MAX_HISTORY. */
export function mergeHistory(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...list].slice(0, MAX_HISTORY);
}

export interface HistoryEntryInput {
  id: string;
  url: string;
  mode: HistoryEntry["mode"];
  report: EngineReport | null;
  complete: boolean;
  pagesDone: number;
  pagesPlanned: number;
  /** Дата скана; по умолчанию сейчас. */
  scannedAt?: string;
}

/** Сводка попытки → запись истории (отчёт срезается до slim). */
export function makeHistoryEntry(input: HistoryEntryInput): HistoryEntry {
  const scan = input.report?.scan;
  return {
    id: input.id,
    url: input.url,
    host: scan?.host ?? hostFromUrl(input.url),
    mode: input.mode,
    scannedAt: input.scannedAt ?? scan?.scannedAt ?? new Date().toISOString(),
    complete: input.complete,
    pagesDone: input.pagesDone,
    pagesPlanned: input.pagesPlanned,
    scores: {
      a11y: scan?.score ?? null,
      security: scan?.security && !scan.security.error ? scan.security.score : null,
      native: input.report?.native && !input.report.native.error ? input.report.native.score : null,
    },
    report: scan ? toSlimReport(scan) : null,
  };
}

function hostFromUrl(url: string): string {
  try {
    return new URL(/^\w+:\/\//.test(url) ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}

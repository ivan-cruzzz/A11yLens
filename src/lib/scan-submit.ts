import type { ScanRequest, ScanResult } from "./types";
import { recordScan } from "./subscription";
import { getPreviousReport, saveReportFull } from "./report-store";
import { computeDiff, type ScanDiff } from "./scan-diff";
import {
  isWatched,
  updateWatchEntry,
  type WatchEntry,
} from "./watchlist";

/**
 * Результат одного скана с клиентской бухгалтерией: лимит тарифа,
 * история отчётов, diff с предыдущим сканом и watchlist уже учтены.
 */
export interface ScanSubmission {
  result: ScanResult;
  diff: ScanDiff | null;
  watching: boolean;
  /** Новые записи watchlist; null — хост не в мониторинге, состояние не меняем. */
  watchEntries: WatchEntry[] | null;
  watchDelta: number | null;
}

/**
 * Единая точка отправки скана для одиночной и массовой проверки:
 * POST /api/scan + запись лимита/истории + diff + watchlist.
 * Раньше этот блок дублировался в runScan и scanBulk страницы /scan.
 */
export async function submitScan(
  request: ScanRequest
): Promise<ScanSubmission> {
  const response = await fetch("/api/scan", {
    body: JSON.stringify(request),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Ошибка сканирования");
  }

  const result = payload as ScanResult;
  recordScan();
  saveReportFull(result);

  const previous = getPreviousReport(result.host, result.scannedAt);
  const watching = isWatched(result.host);
  let watchEntries: WatchEntry[] | null = null;
  let watchDelta: number | null = null;
  if (watching) {
    const updated = updateWatchEntry(result.host, result.score);
    watchEntries = updated.entries;
    watchDelta =
      updated.prevScore === null ? null : result.score - updated.prevScore;
  }

  return {
    result,
    diff: previous ? computeDiff(result, previous) : null,
    watching,
    watchEntries,
    watchDelta,
  };
}

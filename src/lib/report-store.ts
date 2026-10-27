import type { ScanResult } from "./types";

/**
 * Slim-версия отчёта для истории: без base64-скриншотов (они занимают
 * мегабайты), но со всем, что нужно diff/графикам/статистике.
 */
export type SlimReport = ScanResult;

const KEY = "a11ylens:reports:v1";
const MAX_REPORTS = 50;

function stripHeavy(result: ScanResult): SlimReport {
  return {
    ...result,
    pageScreenshot: undefined,
    violations: result.violations.map((violation) => ({
      ...violation,
      nodes: violation.nodes.map((node) => ({
        ...node,
        screenshot: undefined,
      })),
    })),
  };
}

export function getAllReports(): SlimReport[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as SlimReport[];
  } catch {
    return [];
  }
}

function persist(reports: SlimReport[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(reports.slice(0, MAX_REPORTS))
    );
  } catch {
    // Переполнение хранилища: отчёты просто не сохранятся.
  }
}

export function saveReportFull(result: ScanResult): SlimReport[] {
  const next = [stripHeavy(result), ...getAllReports()].slice(0, MAX_REPORTS);
  persist(next);
  return next;
}

export function getReportsByHost(host: string): SlimReport[] {
  return getAllReports().filter(
    (report) => report.host === host || report.url === host
  );
}

/** Предыдущий отчёт по этому хосту (для diff): первый с другим временем скана. */
export function getPreviousReport(
  host: string,
  currentScannedAt: string
): SlimReport | null {
  return (
    getReportsByHost(host).find(
      (report) => report.scannedAt !== currentScannedAt
    ) ?? null
  );
}

export function getLatestByHost(host: string): SlimReport | null {
  return getReportsByHost(host)[0] ?? null;
}

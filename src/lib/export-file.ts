import type { ScanResult } from "./types";

/** Триггерит скачивание файла в браузере. */
export function downloadFile(
  content: string,
  filename: string,
  mime: string
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const escapeCsv = (value: string) =>
  `"${value.replace(/"/g, '""').replace(/\n/g, " ")}"`;

export function reportToJson(result: ScanResult): string {
  return JSON.stringify(
    {
      url: result.url,
      host: result.host,
      scannedAt: result.scannedAt,
      standard: result.standard,
      device: result.device,
      score: result.score,
      counts: result.counts,
      totalViolations: result.totalViolations,
      totalNodes: result.totalNodes,
      meta: result.meta,
      security: result.security
        ? {
            score: result.security.score,
            checksRun: result.security.checksRun,
            findings: result.security.findings,
          }
        : null,
      violations: result.violations.map((violation) => ({
        id: violation.id,
        title: violation.title,
        impact: violation.impact,
        category: violation.category,
        wcagTags: violation.tags,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node) => ({
          selector: node.selector,
          snippet: node.snippet,
        })),
      })),
    },
    null,
    2
  );
}

export function reportToCsv(result: ScanResult): string {
  const rows: string[] = [
    [
      "type",
      "id",
      "title",
      "severity_or_impact",
      "category",
      "selector_or_detail",
      "snippet_or_recommendation",
    ].join(","),
  ];
  const escape = escapeCsv;
  for (const violation of result.violations) {
    for (const node of violation.nodes) {
      rows.push(
        [
          "a11y",
          escape(violation.id),
          escape(violation.title),
          violation.impact,
          violation.category,
          escape(node.selector),
          escape(node.snippet),
        ].join(",")
      );
    }
  }
  for (const findingItem of result.security?.findings ?? []) {
    rows.push(
      [
        "security",
        escape(findingItem.id),
        escape(findingItem.title),
        findingItem.severity,
        "security",
        escape(findingItem.detail),
        escape(findingItem.recommendation),
      ].join(",")
    );
  }
  return rows.join("\n");
}

const safeName = (host: string) => host.replace(/[^\w.-]+/g, "_");

export function downloadReportJson(result: ScanResult) {
  downloadFile(
    reportToJson(result),
    `a11ylens-${safeName(result.host)}-${result.scannedAt.slice(0, 10)}.json`,
    "application/json"
  );
}

export function downloadReportCsv(result: ScanResult) {
  downloadFile(
    reportToCsv(result),
    `a11ylens-${safeName(result.host)}-${result.scannedAt.slice(0, 10)}.csv`,
    "text/csv"
  );
}

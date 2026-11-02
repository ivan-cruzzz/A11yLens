/**
 * CSV-выгрузка отчёта CLI: нарушения доступности, browser-security
 * и нативные находки — одной таблицей с колонкой type.
 */

import type { ScanResult } from "../engine/types";
import type { NativeReport } from "../engine/native";

const escapeCell = (value: string): string =>
  `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

const row = (cells: (string | number)[]): string =>
  cells.map((cell) => escapeCell(String(cell))).join(",");

export function buildCsv(
  result: ScanResult | null,
  native: NativeReport | null,
  showA11y: boolean,
  showSecurity: boolean
): string {
  const lines: string[] = [row(["type", "id", "title", "severity", "detail"])];

  if (result) {
    lines.push(
      row([
        "summary",
        result.host,
        result.url,
        `a11y=${result.score}`,
        `security=${result.security?.score ?? "-"}`,
        `native=${native && !native.error ? native.score : "-"}`,
      ])
    );
  }

  if (result && showA11y) {
    for (const violation of result.violations) {
      lines.push(
        row([
          "a11y",
          violation.id,
          violation.title,
          violation.impact,
          `${violation.category}; ${violation.tags.join(" ")}; узлов: ${violation.nodes.length}`,
        ])
      );
    }
  }

  if (result?.security && showSecurity) {
    for (const finding of result.security.findings) {
      lines.push(
        row(["security", finding.id, finding.title, finding.severity, finding.detail])
      );
    }
  }

  if (native && showSecurity) {
    for (const finding of native.findings) {
      lines.push(
        row([
          "native",
          finding.id,
          finding.title,
          finding.severity,
          `${finding.detail} Доказательство: ${finding.evidence}`,
        ])
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

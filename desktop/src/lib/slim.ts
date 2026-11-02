import type { ScanResult, Violation } from "./report-types";

const stripNodes = (violation: Violation): Violation => ({
  ...violation,
  nodes: violation.nodes.map((node) => ({
    selector: node.selector,
    snippet: node.snippet,
    ...(node.width !== undefined ? { width: node.width } : {}),
    ...(node.height !== undefined ? { height: node.height } : {}),
  })),
});

/**
 * Срез тяжёлых полей для хранения в локальной истории (файл в app data):
 * уходят скриншот страницы и base64-скриншоты узлов. Селекторы, сниппеты,
 * скоры и находки остаются — отчёт из истории читается полностью.
 * Исходный отчёт не мутируется.
 */
export function toSlimReport(report: ScanResult): ScanResult {
  return {
    ...report,
    pageScreenshot: undefined,
    violations: report.violations.map(stripNodes),
  };
}

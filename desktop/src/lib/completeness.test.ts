import { describe, expect, it } from "vitest";
import { assessCompleteness } from "./completeness";
import type { EngineReport } from "./report-types";

const reportWith = (overrides: {
  pagesDone?: number;
  nativeError?: string;
  securityError?: string;
  nativeDegradations?: string[];
}): EngineReport => {
  const pages = Array.from({ length: overrides.pagesDone ?? 4 }, (_, i) => ({
    url: `https://example.com/page${i}`,
    title: `p${i}`,
    isMain: i === 0,
    violations: 0,
    loadMs: 100,
  }));
  return {
    scan: {
      url: "https://example.com/",
      host: "example.com",
      scannedAt: "2026-11-02T12:00:00.000Z",
      standard: "AA",
      device: "desktop",
      score: 100,
      counts: { contrast: 0, alt: 0, keyboard: 0, forms: 0, aria: 0, other: 0 },
      totalViolations: 0,
      totalNodes: 0,
      meta: { title: "t", loadMs: 1, rulesRun: 1, passedRules: 1, incompleteRules: 0 },
      violations: [],
      security: overrides.securityError
        ? { score: 0, findings: [], checksRun: 0, error: overrides.securityError }
        : { score: 100, findings: [], checksRun: 20 },
      pages,
    },
    native: {
      url: "https://example.com/",
      host: "example.com",
      scannedAt: "2026-11-02T12:00:00.000Z",
      mode: "normal",
      score: 100,
      findings: [],
      checksRun: 6,
      technologies: [],
      subdomains: [],
      openPorts: [],
      degradations: overrides.nativeDegradations ?? [],
      ...(overrides.nativeError ? { error: overrides.nativeError } : {}),
    },
  };
};

describe("assessCompleteness — пометка «неполный» и план продолжения (R04.3)", () => {
  it("полный отчёт: complete, страниц сколько запланировано, продолжать нечего", () => {
    const c = assessCompleteness({
      report: reportWith({ pagesDone: 4 }),
      plannedPages: 4,
      sidecarFailed: false,
    });
    expect(c.complete).toBe(true);
    expect(c.pagesDone).toBe(4);
    expect(c.remainingPages).toBe(0);
    expect(c.reasons).toEqual([]);
  });

  it("движок осилил 2 страницы из 4 — неполный, осталось 2", () => {
    const c = assessCompleteness({
      report: reportWith({ pagesDone: 2 }),
      plannedPages: 4,
      sidecarFailed: false,
    });
    expect(c.complete).toBe(false);
    expect(c.pagesDone).toBe(2);
    expect(c.remainingPages).toBe(2);
    expect(c.reasons.some((r) => r.includes("2 из 4"))).toBe(true);
  });

  it("sidecar упал без JSON — неполный, продолжать с нуля плана", () => {
    const c = assessCompleteness({
      report: null,
      plannedPages: 4,
      sidecarFailed: true,
    });
    expect(c.complete).toBe(false);
    expect(c.pagesDone).toBe(0);
    expect(c.remainingPages).toBe(4);
    expect(c.reasons.length).toBeGreaterThan(0);
  });

  it("ошибка нативного аудита делает отчёт неполным", () => {
    const c = assessCompleteness({
      report: reportWith({ nativeError: "DNS недоступен" }),
      plannedPages: 2,
      sidecarFailed: false,
    });
    expect(c.complete).toBe(false);
    expect(c.remainingPages).toBe(0);
  });

  it("ошибка браузерного security-аудита делает отчёт неполным", () => {
    const c = assessCompleteness({
      report: reportWith({ securityError: "Аудит безопасности не выполнен: x" }),
      plannedPages: 2,
      sidecarFailed: false,
    });
    expect(c.complete).toBe(false);
  });

  it("деградации (внешний сервис недоступен) — заметка, но не «неполный»", () => {
    const c = assessCompleteness({
      report: reportWith({ nativeDegradations: ["crt.sh недоступен — поддомены пропущены"] }),
      plannedPages: 2,
      sidecarFailed: false,
    });
    expect(c.complete).toBe(true);
    expect(c.notes.length).toBe(1);
  });

  it("отчёт без pages (старый движок) считается за одну главную страницу", () => {
    const report = reportWith({ pagesDone: 4 });
    delete report.scan?.pages;
    const c = assessCompleteness({ report, plannedPages: 4, sidecarFailed: false });
    expect(c.pagesDone).toBe(1);
  });
});

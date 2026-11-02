import { describe, expect, it } from "vitest";
import { computeDiff } from "../src/lib/scan-diff";
import type { Category, ScanResult } from "../src/lib/types";

const violation = (id: string, title: string, category: Category = "other") => ({
  id,
  title,
  help: title,
  helpUrl: "",
  impact: "serious" as const,
  category,
  tags: [],
  nodes: [],
});

const mkResult = (
  score: number,
  violations: ScanResult["violations"],
  counts?: Partial<Record<Category, number>>
): ScanResult => ({
  url: "https://example.com/",
  host: "example.com",
  scannedAt: "2026-11-02T00:00:00.000Z",
  standard: "AA",
  device: "desktop",
  score,
  counts: {
    contrast: 0,
    alt: 0,
    keyboard: 0,
    forms: 0,
    aria: 0,
    other: 0,
    ...counts,
  },
  totalViolations: violations.length,
  totalNodes: violations.length,
  meta: {
    title: "t",
    loadMs: 1,
    rulesRun: 0,
    passedRules: 0,
    incompleteRules: 0,
  },
  violations,
});

describe("computeDiff", () => {
  it("исправленные и появившиеся нарушения считаются по id", () => {
    const previous = mkResult(
      60,
      [
        violation("color-contrast", "Контраст", "contrast"),
        violation("image-alt", "Нет alt", "alt"),
      ],
      { contrast: 1, alt: 1 }
    );
    const current = mkResult(
      80,
      [
        violation("color-contrast", "Контраст", "contrast"),
        violation("button-name", "Кнопка без имени", "forms"),
      ],
      { contrast: 1, forms: 1 }
    );

    const diff = computeDiff(current, previous);

    expect(diff.previousScore).toBe(60);
    expect(diff.currentScore).toBe(80);
    expect(diff.deltaScore).toBe(20);
    expect(diff.fixed).toEqual([{ id: "image-alt", title: "Нет alt" }]);
    expect(diff.appeared).toEqual([
      { id: "button-name", title: "Кнопка без имени" },
    ]);
    expect(diff.countsDelta.alt).toBe(-1);
    expect(diff.countsDelta.forms).toBe(1);
    expect(diff.countsDelta.contrast).toBe(0);
  });

  it("идентичные отчёты → пустые списки и нулевая дельта", () => {
    const report = mkResult(77, [violation("color-contrast", "Контраст")], {
      contrast: 1,
    });
    const diff = computeDiff(report, report);
    expect(diff.fixed).toEqual([]);
    expect(diff.appeared).toEqual([]);
    expect(diff.deltaScore).toBe(0);
  });
});

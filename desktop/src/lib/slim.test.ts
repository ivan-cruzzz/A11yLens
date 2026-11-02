import { describe, expect, it } from "vitest";
import { toSlimReport } from "./slim";
import type { ScanResult } from "./report-types";

const full: ScanResult = {
  url: "https://example.com/",
  host: "example.com",
  scannedAt: "2026-11-02T12:00:00.000Z",
  standard: "AA",
  device: "desktop",
  score: 80,
  counts: { contrast: 1, alt: 0, keyboard: 0, forms: 0, aria: 0, other: 0 },
  totalViolations: 1,
  totalNodes: 3,
  meta: { title: "Example", loadMs: 400, rulesRun: 60, passedRules: 59, incompleteRules: 0 },
  violations: [
    {
      id: "color-contrast",
      title: "Контраст",
      help: "h",
      helpUrl: "https://axe",
      impact: "serious",
      category: "contrast",
      tags: ["wcag2aa"],
      nodes: [
        { selector: "#a", snippet: "<div/>", screenshot: "data:image/png;base64,AAAA" },
        { selector: "#b", snippet: "<span/>" },
      ],
    },
  ],
  pageScreenshot: { src: "data:image/jpeg;base64,BBBB", width: 1280, height: 800, alt: "a", caption: "c" },
  security: { score: 90, findings: [], checksRun: 20 },
};

describe("toSlimReport — история без тяжёлых картинок", () => {
  it("убирает скриншот страницы", () => {
    const slim = toSlimReport(full);
    expect(slim.pageScreenshot).toBeUndefined();
  });

  it("убирает скриншоты узлов, но сохраняет селекторы и сниппеты", () => {
    const slim = toSlimReport(full);
    expect(slim.violations[0]?.nodes[0]).toEqual({ selector: "#a", snippet: "<div/>" });
    expect(slim.violations[0]?.nodes[1]).toEqual({ selector: "#b", snippet: "<span/>" });
  });

  it("скоры и счётчики остаются на месте", () => {
    const slim = toSlimReport(full);
    expect(slim.score).toBe(80);
    expect(slim.totalNodes).toBe(3);
    expect(slim.security?.score).toBe(90);
  });

  it("исходный отчёт не мутирует", () => {
    toSlimReport(full);
    expect(full.pageScreenshot?.src).toBe("data:image/jpeg;base64,BBBB");
    expect(full.violations[0]?.nodes[0]?.screenshot).toBe("data:image/png;base64,AAAA");
  });

  it("отчёт без скриншотов проходит как есть", () => {
    const { pageScreenshot: _page, ...without } = full;
    const slim = toSlimReport(without);
    expect(slim.totalViolations).toBe(1);
  });
});

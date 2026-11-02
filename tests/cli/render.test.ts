import { describe, expect, it } from "vitest";
import { buildPlan, renderReport } from "../../src/cli/render";
import type { NativeReport } from "../../src/engine/native";
import type { ScanResult } from "../../src/engine";

const scanResult = (): ScanResult =>
  ({
    url: "https://example.com/",
    host: "example.com",
    scannedAt: "2026-11-02T12:00:00.000Z",
    standard: "AA",
    device: "desktop",
    score: 72,
    counts: { contrast: 1, alt: 0, keyboard: 0, forms: 0, aria: 0, other: 0 },
    totalViolations: 1,
    totalNodes: 2,
    meta: { title: "Example", loadMs: 100, rulesRun: 5, passedRules: 4, incompleteRules: 0 },
    violations: [
      {
        id: "color-contrast",
        title: "Элементы с недостаточным контрастом",
        help: "Элементы с недостаточным контрастом",
        helpUrl: "https://deque.university/rules/color-contrast",
        impact: "serious",
        category: "contrast",
        tags: ["wcag2aa"],
        nodes: [{ selector: "p", snippet: "<p>" }],
      },
    ],
    security: {
      score: 45,
      checksRun: 20,
      findings: [
        {
          id: "sec-csp",
          title: "Нет Content-Security-Policy",
          severity: "high",
          detail: "Заголовок CSP отсутствует.",
          recommendation: "Добавьте CSP.",
        },
      ],
    },
  }) as ScanResult;

const nativeReport = (overrides: Partial<NativeReport> = {}): NativeReport =>
  ({
    url: "https://example.com/",
    host: "example.com",
    scannedAt: "2026-11-02T12:00:00.000Z",
    mode: "normal",
    score: 55,
    findings: [
      {
        id: "nport-445",
        title: "Открыт порт 445 (SMB)",
        severity: "high",
        detail: "Порт 445 отвечает из интернета.",
        evidence: "TCP-соединение до example.com:445 установлено",
        recommendation: "Закройте SMB фаерволом.",
      },
    ],
    checksRun: 6,
    technologies: [
      { name: "jQuery", version: "3.4.0", category: "library" },
      { name: "Next.js", category: "framework" },
    ],
    subdomains: ["api.example.com", "staging.example.com"],
    openPorts: [445],
    degradations: ["OSV api.osv.dev недоступен (ответ 503) — проверка CVE пропущена"],
    ...overrides,
  }) as NativeReport;

describe("renderReport", () => {
  it("в отчёте есть сводка, скоры, находки, нативная секция и план", () => {
    const text = renderReport({
      result: scanResult(),
      native: nativeReport(),
      showA11y: true,
      showSecurity: true,
    });
    expect(text).toContain("example.com");
    expect(text).toContain("72/100");
    expect(text).toContain("45/100");
    expect(text).toContain("55/100");
    expect(text).toContain("Нарушения доступности");
    expect(text).toContain("Content-Security-Policy");
    expect(text).toContain("Нативные проверки");
    expect(text).toContain("План исправления");
    // Доказательства и рецепты видны.
    expect(text).toContain("Закройте SMB фаерволом.");
  });

  it("нативная секция: порты, поддомены, технологии, деградации", () => {
    const text = renderReport({
      result: null,
      native: nativeReport(),
      showA11y: false,
      showSecurity: true,
    });
    expect(text).toContain("445");
    expect(text).toContain("api.example.com");
    expect(text).toContain("jQuery 3.4.0");
    expect(text).toContain("OSV");
    expect(text).not.toContain("Нарушения доступности");
  });

  it("пустой экран без данных невозможен: нет сканов — есть подсказка", () => {
    const text = renderReport({
      result: null,
      native: null,
      showA11y: true,
      showSecurity: true,
    });
    expect(text).toContain("Не удалось");
  });
});

describe("buildPlan", () => {
  it("план отсортирован по эффекту: high-находки выше a11y serious", () => {
    const plan = buildPlan(scanResult(), nativeReport(), true, true);
    expect(plan.length).toBeGreaterThanOrEqual(3);
    // high security/native (эффект 20) идут раньше a11y serious (8×1).
    const firstSource = plan[0].source;
    expect(["security", "native"]).toContain(firstSource);
    const effects = plan.map((item) => item.effect);
    expect([...effects].sort((a, b) => b - a)).toEqual(effects);
  });

  it("у каждого шага плана есть усилие и действие", () => {
    const plan = buildPlan(scanResult(), nativeReport(), true, true);
    for (const item of plan) {
      expect(item.action.length).toBeGreaterThan(5);
      expect(["минуты", "часы", "дни"]).toContain(item.effort);
      expect(item.effect).toBeGreaterThan(0);
    }
  });
});

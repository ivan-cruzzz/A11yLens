import { describe, expect, it } from "vitest";
import {
  buildRemediationPlan,
  classifyScanError,
  formatScanFailure,
  isCleanReport,
  simulateScores,
  type RemediationStep,
} from "../../src/engine/report";
import type { ScanResult, Violation } from "../../src/engine/types";

// ── Фикстуры ─────────────────────────────────────────────────────────────────

let seq = 0;
const violation = (
  id: string,
  impact: Violation["impact"],
  nodes: number
): Violation => ({
  id,
  title: id,
  help: id,
  helpUrl: `https://deque.example/${id}`,
  impact,
  category: "other",
  tags: ["wcag2a"],
  nodes: Array.from({ length: nodes }, (_, i) => ({
    selector: `#el-${i}`,
    snippet: "<div></div>",
  })),
});

/** Скор посчитан вручную по весам: critical×3 узла = 12·3 = 36, moderate×1 = 4 → 60. */
const REPORT: ScanResult = {
  url: "https://example.com",
  host: "example.com",
  scannedAt: "2026-11-02T10:00:00.000Z",
  standard: "AA",
  device: "desktop",
  score: 60,
  counts: { contrast: 0, alt: 0, keyboard: 0, forms: 0, aria: 0, other: 2 },
  totalViolations: 2,
  totalNodes: 4,
  meta: {
    title: "Example",
    loadMs: 1200,
    rulesRun: 50,
    passedRules: 48,
    incompleteRules: 0,
  },
  violations: [violation("critical-thing", "critical", 3), violation("small-thing", "moderate", 1)],
  security: {
    // 100 − 20 (high) − 5 (low) = 75
    score: 75,
    checksRun: 20,
    findings: [
      {
        id: "sec-csp",
        title: "Нет CSP",
        severity: "high",
        detail: "Заголовок отсутствует.",
        recommendation: "Добавьте CSP.",
        evidence: "В ответе нет Content-Security-Policy.",
      },
      {
        id: "sec-nosniff",
        title: "Нет X-Content-Type-Options",
        severity: "low",
        detail: "Заголовок отсутствует.",
        recommendation: "Добавьте nosniff.",
        evidence: "В ответе нет X-Content-Type-Options.",
      },
    ],
  },
};

const CLEAN: ScanResult = {
  ...REPORT,
  score: 100,
  totalViolations: 0,
  totalNodes: 0,
  counts: { contrast: 0, alt: 0, keyboard: 0, forms: 0, aria: 0, other: 0 },
  violations: [],
  security: { score: 100, checksRun: 20, findings: [] },
};

// ── Классификация ошибок недоступности ───────────────────────────────────────

describe("classifyScanError", () => {
  it("DNS-сбой распознаётся с чек-листом", () => {
    const failure = classifyScanError(
      "page.goto: net::ERR_NAME_NOT_RESOLVED at https://example.com"
    );
    expect(failure.kind).toBe("dns");
    expect(failure.checks.length).toBeGreaterThanOrEqual(3);
  });

  it("проблема TLS-сертификата распознаётся", () => {
    expect(classifyScanError("net::ERR_CERT_AUTHORITY_INVALID").kind).toBe(
      "tls"
    );
  });

  it("HTTP 404 распознаётся как отсутствующая страница", () => {
    expect(classifyScanError("Запрос вернул HTTP 404").kind).toBe("not-found");
    expect(
      classifyScanError("net::ERR_HTTP_RESPONSE_CODE_FAILURE").kind
    ).toBe("not-found");
  });

  it("таймаут распознаётся", () => {
    expect(classifyScanError("page.goto: Timeout 30000ms exceeded").kind).toBe(
      "timeout"
    );
    expect(
      classifyScanError("Анализ доступности не уложился в отведённое время")
        .kind
    ).toBe("timeout");
  });

  it("неизвестная ошибка сохраняет исходное сообщение", () => {
    const failure = classifyScanError("совершенно неожиданный сбой");
    expect(failure.kind).toBe("unknown");
    expect(failure.detail).toContain("совершенно неожиданный сбой");
  });

  it("formatScanFailure собирает заголовок и нумерованный чек-лист", () => {
    const text = formatScanFailure(
      classifyScanError("net::ERR_NAME_NOT_RESOLVED")
    );
    expect(text).toMatch(/DNS/);
    expect(text).toMatch(/1\)/);
    expect(text).toMatch(/2\)/);
  });
});

// ── Симуляция «если исправите» ───────────────────────────────────────────────

describe("simulateScores", () => {
  it("без отметок сходится со скором отчёта (посчитанным по весам вручную: 60 и 75)", () => {
    const simulation = simulateScores(REPORT, []);
    expect(simulation.score).toBe(60);
    expect(simulation.score).toBe(REPORT.score);
    expect(simulation.securityScore).toBe(75);
    expect(simulation.securityScore).toBe(REPORT.security!.score);
  });

  it("отметка critical-нарушения возвращает 36 очков: 100 − 12·3 − 4 = 60 → 96", () => {
    const simulation = simulateScores(REPORT, ["critical-thing"]);
    expect(simulation.score).toBe(96);
    expect(simulation.securityScore).toBe(75);
  });

  it("отметка high-находки возвращает 20 очков: 75 → 95", () => {
    const simulation = simulateScores(REPORT, ["sec-csp"]);
    expect(simulation.score).toBe(60);
    expect(simulation.securityScore).toBe(95);
  });

  it("все отметки → оба скора 100", () => {
    const simulation = simulateScores(REPORT, [
      "critical-thing",
      "small-thing",
      "sec-csp",
      "sec-nosniff",
    ]);
    expect(simulation.score).toBe(100);
    expect(simulation.securityScore).toBe(100);
  });

  it("для отчёта без security-секции securityScore === null", () => {
    const simulation = simulateScores({ ...REPORT, security: undefined }, []);
    expect(simulation.securityScore).toBeNull();
  });
});

// ── План исправления ─────────────────────────────────────────────────────────

describe("buildRemediationPlan", () => {
  const plan = buildRemediationPlan(REPORT);

  it("для непустого отчёта не меньше трёх шагов", () => {
    expect(plan.length).toBeGreaterThanOrEqual(3);
  });

  it("шаги отсортированы по убыванию эффекта на скор", () => {
    const gains = plan.map((step) => step.scoreGain);
    const sorted = [...gains].sort((a, b) => b - a);
    expect(gains).toEqual(sorted);
  });

  it("эффект сходится с весами движка: critical×3 узла = 36, high = 20", () => {
    expect(plan[0].scoreGain).toBe(36);
    expect(plan.map((s) => s.id)).toContain("sec-csp");
    const csp = plan.find((s) => s.id === "sec-csp") as RemediationStep;
    expect(csp.scoreGain).toBe(20);
  });

  it("у каждого шага есть объяснение, рецепт и усилие из минут/часов/дней", () => {
    const units = new Set(["minutes", "hours", "days"]);
    for (const step of plan) {
      expect(step.why.length).toBeGreaterThan(20);
      expect(step.recommendation.length).toBeGreaterThan(10);
      expect(units.has(step.effort)).toBe(true);
      expect(step.effortLabel.length).toBeGreaterThan(3);
    }
  });

  it("в первом шаге указано, сколько очков он вернёт", () => {
    expect(plan[0].scoreGain).toBeGreaterThan(0);
  });

  it("чистый отчёт не порождает план", () => {
    expect(buildRemediationPlan(CLEAN)).toEqual([]);
  });
});

describe("isCleanReport", () => {
  it("нулевые нарушения и находки — чисто", () => {
    expect(isCleanReport(CLEAN)).toBe(true);
  });
  it("нарушение доступности — не чисто", () => {
    expect(isCleanReport(REPORT)).toBe(false);
  });
  it("находка безопасности — не чисто", () => {
    expect(
      isCleanReport({ ...CLEAN, security: REPORT.security })
    ).toBe(false);
  });
  it("сбой security-аудита — не чисто", () => {
    expect(
      isCleanReport({
        ...CLEAN,
        security: { score: 0, findings: [], checksRun: 0, error: "сбой" },
      })
    ).toBe(false);
  });
});

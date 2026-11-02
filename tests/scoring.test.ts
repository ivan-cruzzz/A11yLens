import { describe, expect, it } from "vitest";
import {
  IMPACT_WEIGHTS,
  SEVERITY_WEIGHTS,
  computeAccessibilityScore,
  computeSecurityScore,
} from "../src/engine";

describe("computeAccessibilityScore", () => {
  it("пустой список нарушений → 100", () => {
    expect(computeAccessibilityScore([])).toBe(100);
  });

  it("critical с двумя узлами → 100 − 12×2 = 76", () => {
    expect(
      computeAccessibilityScore([{ impact: "critical", nodes: [{}, {}] }])
    ).toBe(76);
  });

  it("violation без узлов считается как один узел: serious → 92", () => {
    expect(computeAccessibilityScore([{ impact: "serious", nodes: [] }])).toBe(
      92
    );
  });

  it("вклад узлов ограничен шестью: critical с 10 узлами → 100 − 12×6 = 28", () => {
    expect(
      computeAccessibilityScore([
        { impact: "critical", nodes: Array.from({ length: 10 }, () => ({})) },
      ])
    ).toBe(28);
  });

  it("не уходит ниже нуля", () => {
    const many = Array.from({ length: 12 }, () => ({
      impact: "critical" as const,
      nodes: [{}],
    }));
    expect(computeAccessibilityScore(many)).toBe(0);
  });
});

describe("computeSecurityScore", () => {
  it("high + medium → 100 − 20 − 10 = 70", () => {
    expect(
      computeSecurityScore([{ severity: "high" }, { severity: "medium" }])
    ).toBe(70);
  });

  it("info не штрафует", () => {
    expect(
      computeSecurityScore([{ severity: "info" }, { severity: "info" }])
    ).toBe(100);
  });

  it("не уходит ниже нуля", () => {
    const many = Array.from({ length: 8 }, () => ({
      severity: "high" as const,
    }));
    expect(computeSecurityScore(many)).toBe(0);
  });
});

describe("веса скоринга — единственный источник", () => {
  it("IMPACT_WEIGHTS совпадает с формулой отчёта (12/8/4/2)", () => {
    expect(IMPACT_WEIGHTS).toEqual({
      critical: 12,
      serious: 8,
      moderate: 4,
      minor: 2,
    });
  });

  it("SEVERITY_WEIGHTS совпадает с формулой аудита (20/10/5/0)", () => {
    expect(SEVERITY_WEIGHTS).toEqual({
      high: 20,
      medium: 10,
      low: 5,
      info: 0,
    });
  });
});

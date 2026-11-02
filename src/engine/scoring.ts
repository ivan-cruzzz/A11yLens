/**
 * Скоринг — единственное место, где заданы веса критичности (impact)
 * и серьёзности security-находок. Веб, CLI и десктоп считают одинаково.
 */

import type { Impact, SecurityFinding, SecuritySeverity } from "./types";

export const IMPACT_WEIGHTS: Record<Impact, number> = {
  critical: 12,
  serious: 8,
  moderate: 4,
  minor: 2,
};

export const IMPACT_ORDER: Record<Impact, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

export const SEVERITY_WEIGHTS: Record<SecuritySeverity, number> = {
  high: 20,
  medium: 10,
  low: 5,
  info: 0,
};

/** Минимальная форма нарушения, достаточная для подсчёта скора. */
export interface ScoredViolation {
  impact: Impact;
  nodes: unknown[];
}

/** 0–100: 100 минус штрафы, вклад узлов ограничен шестью на нарушение. */
export function computeAccessibilityScore(
  violations: readonly ScoredViolation[]
): number {
  const penalty = violations.reduce((sum, violation) => {
    const nodeCount = Math.min(Math.max(violation.nodes.length, 1), 6);
    return sum + IMPACT_WEIGHTS[violation.impact] * nodeCount;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

/** 0–100 по сумме весов серьёзности security-находок. */
export function computeSecurityScore(
  findings: readonly { severity: SecuritySeverity }[]
): number {
  const penalty = findings.reduce(
    (sum, item) => sum + SEVERITY_WEIGHTS[item.severity],
    0
  );
  return Math.max(0, Math.min(100, 100 - penalty));
}

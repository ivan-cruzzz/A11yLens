import type { Category, ScanResult } from "./types";

export interface ScanDiff {
  previousScore: number;
  currentScore: number;
  deltaScore: number;
  fixed: { id: string; title: string }[];
  appeared: { id: string; title: string }[];
  countsDelta: Record<Category, number>;
}

/** Сравнивает текущий отчёт с предыдущим по violation id. */
export function computeDiff(
  current: ScanResult,
  previous: ScanResult
): ScanDiff {
  const prevIds = new Set(previous.violations.map((v) => v.id));
  const currIds = new Set(current.violations.map((v) => v.id));

  return {
    previousScore: previous.score,
    currentScore: current.score,
    deltaScore: current.score - previous.score,
    fixed: previous.violations
      .filter((v) => !currIds.has(v.id))
      .map((v) => ({ id: v.id, title: v.title })),
    appeared: current.violations
      .filter((v) => !prevIds.has(v.id))
      .map((v) => ({ id: v.id, title: v.title })),
    countsDelta: {
      contrast: current.counts.contrast - previous.counts.contrast,
      alt: current.counts.alt - previous.counts.alt,
      keyboard: current.counts.keyboard - previous.counts.keyboard,
      forms: current.counts.forms - previous.counts.forms,
      aria: current.counts.aria - previous.counts.aria,
      other: current.counts.other - previous.counts.other,
    },
  };
}

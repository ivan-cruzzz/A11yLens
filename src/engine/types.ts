/**
 * Модель отчёта A11yLens — единственный источник типов ScanResult.
 * Файл не имеет зависимостей: его импортируют веб (через src/lib/types),
 * CLI и десктоп-сборка.
 */

export type Impact = "critical" | "serious" | "moderate" | "minor";

export type Category =
  | "contrast"
  | "alt"
  | "keyboard"
  | "forms"
  | "aria"
  | "other";

export interface ViolationNode {
  /** CSS selector of the failing element (axe target). */
  selector: string;
  /** Trimmed HTML snippet of the element. */
  snippet: string;
  /** data:image/png;base64 element screenshot, if it could be captured. */
  screenshot?: string;
  width?: number;
  height?: number;
}

export interface Violation {
  id: string;
  title: string;
  help: string;
  helpUrl: string;
  impact: Impact;
  category: Category;
  tags: string[];
  nodes: ViolationNode[];
}

export interface PageScreenshot {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export type Standard = "AA" | "AAA" | "508";
export type Device = "desktop" | "mobile";

export type SecuritySeverity = "high" | "medium" | "low" | "info";

export interface SecurityFinding {
  id: string;
  title: string;
  severity: SecuritySeverity;
  /** Что нашли (конкретика по сайту). */
  detail: string;
  /** Как исправить. */
  recommendation: string;
}

export interface SecurityAudit {
  score: number;
  findings: SecurityFinding[];
  checksRun: number;
  /** Причина, по которой аудит не удалось выполнить (сбой виден в отчёте). */
  error?: string;
}

export interface ScanRequest {
  url?: string;
  html?: string;
  standard: Standard;
  device: Device;
}

export interface ScanMeta {
  title: string;
  loadMs: number;
  rulesRun: number;
  passedRules: number;
  incompleteRules: number;
}

export interface ScanResult {
  url: string;
  host: string;
  scannedAt: string;
  standard: Standard;
  device: Device;
  /** 0–100 accessibility score. */
  score: number;
  counts: Record<Category, number>;
  totalViolations: number;
  totalNodes: number;
  meta: ScanMeta;
  violations: Violation[];
  pageScreenshot?: PageScreenshot;
  /** Появляется, когда сканирование URL (для HTML-файлов не проводится). */
  security?: SecurityAudit;
}

export const SECURITY_SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  high: "высокая",
  medium: "средняя",
  low: "низкая",
  info: "инфо",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  contrast: "Контраст",
  alt: "Alt-тексты",
  keyboard: "Клавиатура",
  forms: "Формы",
  aria: "ARIA и семантика",
  other: "Прочее",
};

export const IMPACT_LABELS: Record<Impact, string> = {
  critical: "критичная",
  serious: "серьёзная",
  moderate: "средняя",
  minor: "незначительная",
};

export const CATEGORY_ORDER: Category[] = [
  "contrast",
  "alt",
  "keyboard",
  "forms",
  "aria",
  "other",
];

/**
 * Локальная копия отчётной модели движка для UI десктопа.
 * Десктоп НЕ импортирует src/ напрямую: типы повторяют ScanResult /
 * NativeReport (engine/types.ts, engine/native/types.ts) и читаются из
 * JSON, который печатает sidecar с флагом --json. Новые поля движка —
 * additive, здесь они опциональны.
 */

export type Impact = "critical" | "serious" | "moderate" | "minor";

export type Category =
  | "contrast"
  | "alt"
  | "keyboard"
  | "forms"
  | "aria"
  | "other";

export type Standard = "AA" | "AAA" | "508";
export type Device = "desktop" | "mobile";
export type SecuritySeverity = "high" | "medium" | "low" | "info";

export interface ViolationNode {
  selector: string;
  snippet: string;
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
  pageUrl?: string;
  why?: string;
}

export interface PageScreenshot {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export interface SecurityFinding {
  id: string;
  title: string;
  severity: SecuritySeverity;
  detail: string;
  recommendation: string;
  evidence?: string;
  why?: string;
}

export interface SecurityAudit {
  score: number;
  findings: SecurityFinding[];
  checksRun: number;
  error?: string;
}

export interface ScanMeta {
  title: string;
  loadMs: number;
  rulesRun: number;
  passedRules: number;
  incompleteRules: number;
}

export interface ScannedPage {
  url: string;
  title: string;
  isMain: boolean;
  violations: number;
  loadMs: number;
}

export interface ScanResult {
  url: string;
  host: string;
  scannedAt: string;
  standard: Standard;
  device: Device;
  score: number;
  counts: Record<Category, number>;
  totalViolations: number;
  totalNodes: number;
  meta: ScanMeta;
  violations: Violation[];
  pageScreenshot?: PageScreenshot;
  security?: SecurityAudit;
  pages?: ScannedPage[];
}

export type NativeScanMode = "quick" | "normal" | "deep";

export interface NativeFinding {
  id: string;
  title: string;
  severity: SecuritySeverity;
  detail: string;
  evidence: string;
  recommendation: string;
}

export type TechCategory =
  | "framework"
  | "cms"
  | "library"
  | "analytics"
  | "server"
  | "cdn";

export interface Technology {
  name: string;
  version?: string;
  category: TechCategory;
}

export interface NativeReport {
  url: string;
  host: string;
  scannedAt: string;
  mode: NativeScanMode;
  score: number;
  findings: NativeFinding[];
  checksRun: number;
  technologies: Technology[];
  subdomains: string[];
  openPorts: number[];
  degradations: string[];
  error?: string;
}

/** То, что печатает sidecar `a11ylens-engine scan <url> --json`. */
export interface EngineReport {
  scan?: ScanResult;
  native?: NativeReport | null;
}

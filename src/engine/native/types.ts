/**
 * Модель нативных проверок — проверки, недоступные браузеру:
 * TLS, TCP-порты, поддомены, CVE библиотек, почтовые DNS-записи.
 * Находки нативных проверок (NativeFinding) не смешиваются с
 * браузерным security-аудитом (SecurityFinding) — у них своя секция отчёта.
 */

import type { SecuritySeverity } from "../types";

/** Режим интенсивности: меняет таймауты/лимиты, не набор векторов. */
export type NativeScanMode = "quick" | "normal" | "deep";

export interface NativeFinding {
  id: string;
  title: string;
  severity: SecuritySeverity;
  /** Что нашли: конкретика по сайту (порт, протокол, CVE-id, DNS-запись). */
  detail: string;
  /** Доказательство: сырой факт, на котором основана находка. */
  evidence: string;
  /** Как исправить. */
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
  /** Версия — если удалось распознать. */
  version?: string;
  category: TechCategory;
}

/** Технологии с распознанной версией — кандидаты на проверку CVE в OSV. */
export interface LibraryInfo {
  name: string;
  version: string;
}

export interface NativeReport {
  url: string;
  host: string;
  scannedAt: string;
  mode: NativeScanMode;
  /** 0–100: чем меньше находок и чем они легче, тем выше. */
  score: number;
  findings: NativeFinding[];
  /** Число выполненных проверок — из реестра NATIVE_CHECKS. */
  checksRun: number;
  /** Инвентарь технологий страницы (A01). */
  technologies: Technology[];
  /** Поддомены, резолвящиеся в DNS (crt.sh + DNS, без брутфорса). */
  subdomains: string[];
  /** Открытые TCP-порты из топ-100. */
  openPorts: number[];
  /**
   * Пометки о деградации: внешний сервис недоступен или данные
   * не скачались — проверка пропущена, скан не падает.
   */
  degradations: string[];
  /** Причина, по которой нативный аудит не удалось выполнить. */
  error?: string;
}

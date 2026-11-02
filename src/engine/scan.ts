/**
 * Мультистраничный обход и доказательства находок (R02):
 * выбор внутренних ссылок, сборка отчёта по страницам,
 * привязка evidence к security-находкам и журнал fetch для проб.
 * Всё чистое, кроме журналирования fetch — оно best-effort.
 */

import { computeAccessibilityScore, IMPACT_ORDER } from "./scoring";
import type { CookieInfo } from "./security";
import type { Category } from "./types";
import type {
  Impact,
  ScanResult,
  ScannedPage,
  SecurityFinding,
  Violation,
} from "./types";

// ── Лимит страниц ────────────────────────────────────────────────────────────

export const DEFAULT_MAX_PAGES = 4;
export const MAX_PAGES_LIMIT = 10;

/** Лимит страниц мультистраничного скана: 1..10, по умолчанию 4. */
export function clampMaxPages(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_MAX_PAGES;
  }
  return Math.max(1, Math.min(MAX_PAGES_LIMIT, Math.floor(raw)));
}

// ── Выбор внутренних ссылок ──────────────────────────────────────────────────

/** Файлы, которые не стоит отдавать в HTML-обход. */
const NON_PAGE_PATH = /\.(pdf|zip|gz|rar|7z|png|jpe?g|gif|webp|avif|svg|ico|mp[34]|webm|mov|docx?|xlsx?|pptx?|csv|rss|xml)$/i;

/**
 * Из списка href страницы выбирает до `limit` уникальных внутренних
 * http(s)-адресов (главная исключается, якоря схлопываются, порядок DOM).
 */
export function pickInternalLinks(
  hrefs: string[],
  baseUrl: string,
  limit: number
): string[] {
  if (limit <= 0) {
    return [];
  }
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  base.hash = "";
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const raw of hrefs) {
    if (picked.length >= limit) {
      break;
    }
    let url: URL;
    try {
      url = new URL(raw, base);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      continue;
    }
    if (url.hostname !== base.hostname) {
      continue;
    }
    if (NON_PAGE_PATH.test(url.pathname)) {
      continue;
    }
    url.hash = "";
    const href = url.href;
    if (href === base.href || seen.has(href)) {
      continue;
    }
    seen.add(href);
    picked.push(href);
  }
  return picked;
}

// ── Сборка отчёта по страницам ───────────────────────────────────────────────

/** Результат аудита одной страницы до сборки общего отчёта. */
export interface PageScanResult {
  url: string;
  title: string;
  isMain: boolean;
  loadMs: number;
  passedRules: number;
  incompleteRules: number;
  violations: Violation[];
}

export interface AggregateReport {
  /** Все нарушения с проставленной страницей, по убыванию критичности. */
  violations: Violation[];
  pages: ScannedPage[];
  counts: Record<Category, number>;
  totalNodes: number;
  /** Скор по объединённым нарушениям — формула engine/scoring.ts. */
  score: number;
  rulesRun: number;
  passedRules: number;
  incompleteRules: number;
}

/**
 * Склеивает результаты страниц в один ScanResult-набор: каждому нарушению —
 * его страница, суммы по категориям/узлам/правилам, сортировка по критичности.
 */
export function aggregatePages(pages: PageScanResult[]): AggregateReport {
  const violations: Violation[] = [];
  const counts: Record<Category, number> = {
    contrast: 0,
    alt: 0,
    keyboard: 0,
    forms: 0,
    aria: 0,
    other: 0,
  };
  let totalNodes = 0;
  let rulesRun = 0;
  let passedRules = 0;
  let incompleteRules = 0;
  const pageSummaries: ScannedPage[] = [];

  for (const page of pages) {
    for (const violation of page.violations) {
      violations.push({ ...violation, pageUrl: page.url });
      counts[violation.category] += 1;
      totalNodes += Math.max(violation.nodes.length, 1);
    }
    rulesRun += page.passedRules + page.violations.length;
    passedRules += page.passedRules;
    incompleteRules += page.incompleteRules;
    pageSummaries.push({
      url: page.url,
      title: page.title,
      isMain: page.isMain,
      violations: page.violations.length,
      loadMs: page.loadMs,
    });
  }

  violations.sort(
    (a, b) =>
      (IMPACT_ORDER[a.impact as Impact] ?? 3) -
      (IMPACT_ORDER[b.impact as Impact] ?? 3)
  );

  return {
    violations,
    pages: pageSummaries,
    counts,
    totalNodes,
    score: computeAccessibilityScore(violations),
    rulesRun,
    passedRules,
    incompleteRules,
  };
}

// ── Доказательства security-находок ──────────────────────────────────────────

export interface FetchLogEntry {
  url: string;
  status: number;
  /** Первые байты тела — источник фрагмента-доказательства. */
  bodyHead: string;
}

/** Контекст, собранный при загрузке страницы, — источник доказательств. */
export interface EvidenceContext {
  /** Заголовки ответа в нижнем регистре ключей. */
  headers: Record<string, string>;
  cookies: CookieInfo[];
  insecureResources: string[];
  externals: { src: string; hasIntegrity: boolean }[];
  poweredBy?: string;
  generator?: string;
  jqueryVersion?: string;
  fetchLog: FetchLogEntry[];
}

const HEADER_BY_ID: Record<string, string> = {
  "sec-csp": "Content-Security-Policy",
  "sec-hsts": "Strict-Transport-Security",
  "sec-nosniff": "X-Content-Type-Options",
  "sec-referrer": "Referrer-Policy",
  "sec-permissions": "Permissions-Policy",
  "sec-coop": "Cross-Origin-Opener-Policy",
};

const PROBE_PATH_BY_ID: Record<string, string> = {
  "sec-git-exposed": "/.git/HEAD",
  "sec-env-exposed": "/.env",
  "sec-phpinfo": "/phpinfo.php",
  "sec-backup-config": "/wp-config.php.bak",
  "sec-dsstore": "/.DS_Store",
};

/**
 * Маскирует секреты в фрагменте тела: KEY=VALUE (ВЕРХНИЙ_РЕГИСТР)
 * превращается в KEY=*** — доказательство не должно утаскивать значения.
 */
export function redactBody(text: string): string {
  const printable = text.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ""
  );
  const redacted = printable.replace(
    /([A-Z][A-Z0-9_]{2,})=([^\s;"']+)/g,
    "$1=***"
  );
  if (redacted.length > 140) {
    return `${redacted.slice(0, 137)}…`;
  }
  return redacted;
}

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function evidenceFor(
  finding: SecurityFinding,
  context: EvidenceContext
): string {
  const { headers, cookies } = context;
  const headerNames = Object.keys(headers);

  if (HEADER_BY_ID[finding.id]) {
    return `В ответе нет заголовка ${HEADER_BY_ID[finding.id]}. Получены заголовки: ${
      headerNames.slice(0, 10).join(", ") || "ни одного"
    }.`;
  }
  if (finding.id === "sec-clickjacking") {
    const csp = headers["content-security-policy"] ?? "";
    return `X-Frame-Options: ${
      headers["x-frame-options"] ?? "отсутствует"
    }; в Content-Security-Policy ${
      csp.includes("frame-ancestors") ? "есть frame-ancestors" : "нет frame-ancestors"
    }.`;
  }
  if (finding.id === "sec-cookie-secure" || finding.id === "sec-cookie-httponly" || finding.id === "sec-cookie-samesite") {
    const affected = cookies.filter((cookie) =>
      finding.id === "sec-cookie-secure"
        ? !cookie.secure
        : finding.id === "sec-cookie-httponly"
          ? !cookie.httpOnly
          : !cookie.sameSite || cookie.sameSite === "None"
    );
    if (affected.length === 0) {
      return finding.detail;
    }
    const shown = affected
      .slice(0, 3)
      .map(
        (cookie) =>
          `${cookie.name} (Secure: ${cookie.secure ? "да" : "нет"}, HttpOnly: ${
            cookie.httpOnly ? "да" : "нет"
          }, SameSite: ${cookie.sameSite || "не задан"})`
      )
      .join("; ");
    return `Куки контекста: ${shown}${affected.length > 3 ? ` и ещё ${affected.length - 3}` : ""}.`;
  }
  if (finding.id === "sec-mixed-content") {
    return `HTTP-ресурсы на странице: ${context.insecureResources
      .slice(0, 3)
      .join(", ")}.`;
  }
  if (finding.id === "sec-sri") {
    const missing = context.externals
      .filter((item) => !item.hasIntegrity)
      .slice(0, 2)
      .map((item) => item.src);
    return `Внешние скрипты без integrity: ${missing.join(", ") || finding.detail}.`;
  }
  if (finding.id === "sec-version-disclosure") {
    const leaks: string[] = [];
    if (context.poweredBy) {
      leaks.push(`X-Powered-By: ${context.poweredBy}`);
    }
    if (context.generator) {
      leaks.push(`meta generator: ${context.generator}`);
    }
    return leaks.length > 0 ? `${leaks.join("; ")}.` : finding.detail;
  }
  if (finding.id === "sec-jquery-version") {
    return context.jqueryVersion
      ? `window.jQuery.fn.jquery = "${context.jqueryVersion}".`
      : finding.detail;
  }
  if (finding.id === "sec-https-redirect") {
    const entry = context.fetchLog.find((item) => item.url.startsWith("http://"));
    return entry
      ? `GET ${entry.url} → ${entry.status}, редирект на HTTPS не выполнен.`
      : finding.detail;
  }
  const probePath = PROBE_PATH_BY_ID[finding.id];
  if (probePath) {
    const entry = context.fetchLog.find((item) => item.url.endsWith(probePath));
    if (entry) {
      return `GET ${entry.url} → ${entry.status}; фрагмент тела: «${redactBody(
        entry.bodyHead
      )}»`;
    }
    return finding.detail;
  }
  return finding.detail;
}

/**
 * Привязывает к каждой находке доказательство из собранного контекста.
 * Находка без evidence не считается сработавшей, поэтому fallback —
 * её же detail: находка не теряется и остаётся обоснованной.
 */
export function attachEvidence(
  findings: SecurityFinding[],
  context: EvidenceContext
): SecurityFinding[] {
  return findings.map((finding) => ({
    ...finding,
    evidence: truncate(evidenceFor(finding, context), 400),
  }));
}

// ── Журналирование fetch для доказательств проб ──────────────────────────────

/**
 * На время `run` оборачивает globalThis.fetch и записывает ответы,
 * подходящие под `match`. Best-effort: при параллельных сканах в одном
 * процессе запись может перемешаться — attachEvidence тогда берёт fallback.
 */
export async function withFetchRecorder<T>(
  match: (url: string) => boolean,
  run: () => Promise<T>
): Promise<{ value: T; log: FetchLogEntry[] }> {
  const log: FetchLogEntry[] = [];
  const original = globalThis.fetch;
  const recorded = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    const response = await original(input, init);
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (match(url)) {
        const bodyHead = (await response.clone().text()).slice(0, 300);
        log.push({ url, status: response.status, bodyHead });
      }
    } catch {
      // Журналирование доказательств не должно ломать проверку.
    }
    return response;
  }) as typeof fetch;

  globalThis.fetch = recorded;
  try {
    const value = await run();
    return { value, log };
  } finally {
    globalThis.fetch = original;
  }
}

// Переэкспорт типа, чтобы потребители scan.ts не тянули types напрямую.
export type { ScanResult, ScannedPage, SecurityFinding, Violation };

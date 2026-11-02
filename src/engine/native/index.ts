/**
 * Нативный аудит (без браузера, только node tls/dns/net/fetch):
 * TLS, топ-100 портов, поддомены через crt.sh, CVE библиотек через OSV,
 * почтовые записи SPF/DKIM/DMARC + инвентарь технологий страницы.
 * Публичная точка входа — runNativeAudit(url, mode), для CLI и десктопа.
 * Все проверки идут параллельно; недоступность внешних сервисов —
 * деградация с пометкой, а не падение скана.
 */

import { SEVERITY_ORDER, computeSecurityScore } from "../scoring";
import { normalizeUrl, assertPublicHttpUrl } from "../url-guard";
import { checkLibraryCves, fetchOsv, librariesFromTechnologies } from "./cve";
import { auditEmailSecurity, createTxtCache, resolveTxtDns } from "./email";
import { scanPorts, probePort } from "./ports";
import { findSubdomains, fetchCrtSh, resolveHost } from "./subdomains";
import { detectTechnologies } from "./tech";
import type {
  LibraryInfo,
  NativeFinding,
  NativeReport,
  NativeScanMode,
  Technology,
} from "./types";
import { auditTls, probeTls, type TlsProbeFn } from "./tls";
import type { CrtShFetch, HostResolver } from "./subdomains";
import type { PortProbeFn } from "./ports";
import type { OsvFetch } from "./cve";
import type { TxtResolver } from "./email";

export type { NativeScanMode } from "./types";
export type { NativeReport, NativeFinding, Technology, LibraryInfo } from "./types";

/** Реестр нативных проверок — источник checksRun, никакого хардкода. */
export const NATIVE_CHECKS: readonly { id: string; title: string }[] = [
  { id: "native-tls", title: "TLS-аудит" },
  { id: "native-ports", title: "Открытые порты (топ-100)" },
  { id: "native-subdomains", title: "Поддомены (crt.sh + DNS)" },
  { id: "native-cve", title: "CVE библиотек (OSV)" },
  { id: "native-email", title: "Почта домена (SPF/DKIM/DMARC)" },
  { id: "native-tech", title: "Инвентарь технологий" },
];

/** Режимы меняют таймауты и лимиты, не набор векторов. */
export interface NativeModeConfig {
  subdomainLimit: number;
  crtTimeoutMs: number;
  pageTimeoutMs: number;
}

export const NATIVE_MODES: Record<NativeScanMode, NativeModeConfig> = {
  quick: { subdomainLimit: 25, crtTimeoutMs: 5000, pageTimeoutMs: 10_000 },
  normal: { subdomainLimit: 60, crtTimeoutMs: 15_000, pageTimeoutMs: 15_000 },
  deep: { subdomainLimit: 100, crtTimeoutMs: 30_000, pageTimeoutMs: 25_000 },
};

export interface PageFetchResult {
  ok: boolean;
  status: number;
  html: string;
  headers: Record<string, string>;
}

export type PageFetch = (url: string) => Promise<PageFetchResult>;

export interface NativeAuditDeps {
  fetchPage?: PageFetch;
  probeTls?: TlsProbeFn;
  probePort?: PortProbeFn;
  fetchCrtSh?: CrtShFetch;
  resolveHost?: HostResolver;
  resolveTxt?: TxtResolver;
  osvFetch?: OsvFetch;
  /** SSRF-заслон: по умолчанию assertPublicHttpUrl (DNS не должен смотреть внутрь). */
  dnsGuard?: (url: string) => Promise<void>;
  now?: () => Date;
}

const emptyReport = (url: string, host: string, mode: NativeScanMode): NativeReport => ({
  url,
  host,
  scannedAt: new Date().toISOString(),
  mode,
  score: 100,
  findings: [],
  checksRun: NATIVE_CHECKS.length,
  technologies: [],
  subdomains: [],
  openPorts: [],
  degradations: [],
});

const sortFindings = (findings: NativeFinding[]): NativeFinding[] =>
  [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

/** Реальная загрузка страницы лёгким GET — HTML нужен только инвентарю технологий. */
export async function fetchPage(url: string): Promise<PageFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "A11yLens-native-audit" },
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return {
      ok: response.ok,
      status: response.status,
      html: await response.text(),
      headers,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runNativeAudit(
  rawUrl: string,
  mode: NativeScanMode = "normal",
  deps: NativeAuditDeps = {}
): Promise<NativeReport> {
  let url: string;
  try {
    url = normalizeUrl(rawUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ...emptyReport(rawUrl, rawUrl, mode), score: 0, checksRun: 0, error: reason };
  }
  const host = new URL(url).hostname;
  const config = NATIVE_MODES[mode];
  const dnsGuard = deps.dnsGuard ?? assertPublicHttpUrl;

  try {
    await dnsGuard(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ...emptyReport(url, host, mode), score: 0, checksRun: 0, error: reason };
  }

  const now = deps.now ?? Date.now;
  const startedAt = now();
  const txtCache = createTxtCache(deps.resolveTxt ?? resolveTxtDns);

  // Страница нужна только инвентарю технологий и CVE — её недоступность
  // не отменяет TLS/порты/поддомены/почту.
  const pagePromise: Promise<PageFetchResult | null> = (async () => {
    try {
      const fetch = deps.fetchPage ?? fetchPage;
      return await fetch(url);
    } catch {
      return null;
    }
  })();

  const tlsPromise = auditTls(host, deps.probeTls ? { probe: deps.probeTls } : {});
  const portsPromise = scanPorts(
    host,
    {},
    deps.probePort ? { probe: deps.probePort } : {}
  );
  const subdomainsPromise = findSubdomains(
    host,
    { limit: config.subdomainLimit, timeoutMs: config.crtTimeoutMs },
    {
      ...(deps.fetchCrtSh ? { fetchCrtSh: deps.fetchCrtSh } : {}),
      ...(deps.resolveHost ? { resolve: deps.resolveHost } : {}),
    }
  );
  const emailPromise = auditEmailSecurity(host, { resolveTxt: txtCache.resolveTxt });

  const [page, tlsFindings, portScan, subdomains, email] = await Promise.all([
    pagePromise,
    tlsPromise,
    portsPromise,
    subdomainsPromise,
    emailPromise,
  ]);

  const degradations: string[] = [...subdomains.degradations];

  let technologies: Technology[] = [];
  let cveFindings: NativeFinding[] = [];
  if (page === null) {
    degradations.push(
      "Страница не скачалась — инвентарь технологий и проверка CVE пропущены"
    );
  } else {
    if (!page.ok) {
      degradations.push(
        `Страница ответила ${page.status} — инвентарь технологий может быть неполным`
      );
    }
    technologies = detectTechnologies({
      html: page.html,
      headers: page.headers,
      url,
    });
    const libraries: LibraryInfo[] = librariesFromTechnologies(technologies);
    const cve = await checkLibraryCves(libraries, deps.osvFetch ? { fetch: deps.osvFetch } : {});
    cveFindings = cve.findings;
    degradations.push(...cve.degradations);
  }

  const findings = sortFindings([
    ...tlsFindings,
    ...portScan.findings,
    ...subdomains.findings,
    ...email.findings,
    ...cveFindings,
  ]);

  return {
    url,
    host,
    scannedAt: new Date(startedAt).toISOString(),
    mode,
    score: computeSecurityScore(findings),
    findings,
    checksRun: NATIVE_CHECKS.length,
    technologies,
    subdomains: subdomains.subdomains,
    openPorts: portScan.openPorts,
    degradations,
  };
}

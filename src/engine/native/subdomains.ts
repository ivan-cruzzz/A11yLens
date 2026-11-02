/**
 * Пассивный поиск поддоменов через crt.sh (Certificate Transparency)
 * + DNS-резолв. Без брутфорса и перебора словарей: только то, что
 * публично видно в сертификатах.
 */

import { promises as dns } from "node:dns";
import type { NativeFinding } from "./types";

export const DEFAULT_SUBDOMAIN_LIMIT = 60;

export interface CrtShEntry {
  name_value?: string;
  common_name?: string;
}

export type CrtShFetch = (domain: string, timeoutMs?: number) => Promise<CrtShEntry[]>;

export type HostResolver = (host: string) => Promise<boolean>;

export interface SubdomainOptions {
  /** Сколько кандидатов максимум резолвим (лимиты режима). */
  limit?: number;
  /** Таймаут запроса к crt.sh (лимиты режима). */
  timeoutMs?: number;
}

export interface SubdomainDeps {
  fetchCrtSh?: CrtShFetch;
  resolve?: HostResolver;
}

export interface SubdomainResult {
  /** Резолвящиеся поддомены (без apex-домена). */
  subdomains: string[];
  findings: NativeFinding[];
  degradations: string[];
}

const finding = (
  id: string,
  title: string,
  severity: NativeFinding["severity"],
  detail: string,
  evidence: string,
  recommendation: string
): NativeFinding => ({ id, title, severity, detail, evidence, recommendation });

/** Достаём имена из crt.sh-записей: name_value может содержать несколько строк. */
export function candidateNames(
  domain: string,
  entries: CrtShEntry[]
): string[] {
  const suffix = `.${domain.toLowerCase()}`;
  const names = new Set<string>();
  for (const entry of entries) {
    const raw = [entry.name_value ?? "", entry.common_name ?? ""].join("\n");
    for (const line of raw.split("\n")) {
      const name = line.trim().toLowerCase().replace(/^\*\./, "");
      if (!name || !name.endsWith(suffix)) {
        continue;
      }
      const bare = name.slice(0, -suffix.length);
      // Точка в остатке — вложенный поддомен, тоже валиден; пустой остаток — apex.
      if (bare === "") {
        continue;
      }
      names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * crt.sh отдаёт JSON с публичных Certificate Transparency-логов;
 * иногда отвечает мусором/таймаутом — тогда честная деградация.
 */
export async function fetchCrtSh(domain: string, timeoutMs = 15_000): Promise<CrtShEntry[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
      {
        signal: controller.signal,
        headers: { "user-agent": "A11yLens-native-audit" },
      }
    );
    if (!response.ok) {
      throw new Error(`crt.sh ответил ${response.status}`);
    }
    const payload: unknown = await response.json();
    return Array.isArray(payload) ? (payload as CrtShEntry[]) : [];
  } finally {
    clearTimeout(timer);
  }
}

/** Резолвит ли имя в DNS (любой адрес). */
export async function resolveHost(host: string, timeoutMs = 3000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const lookup = dns.lookup(host, { all: true });
    const guard = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("dns timeout")), timeoutMs);
    });
    await Promise.race([lookup, guard]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function findSubdomains(
  domain: string,
  options: SubdomainOptions = {},
  deps: SubdomainDeps = {}
): Promise<SubdomainResult> {
  const fetchEntries = deps.fetchCrtSh ?? fetchCrtSh;
  const resolve = deps.resolve ?? resolveHost;
  const limit = options.limit ?? DEFAULT_SUBDOMAIN_LIMIT;

  let entries: CrtShEntry[];
  try {
    entries = await fetchEntries(domain, options.timeoutMs);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      subdomains: [],
      findings: [],
      degradations: [
        `crt.sh недоступен (${reason}) — пассивный поиск поддоменов пропущен`,
      ],
    };
  }

  const candidates = candidateNames(domain, entries).slice(0, limit);
  const checks = await Promise.all(
    candidates.map(async (name): Promise<string | null> => {
      try {
        return (await resolve(name)) ? name : null;
      } catch {
        return null;
      }
    })
  );
  const subdomains = checks.filter((name): name is string => name !== null);

  const findings: NativeFinding[] = [];
  if (subdomains.length > 0) {
    findings.push(
      finding(
        "nsub-inventory",
        `Поддомены: найдено ${subdomains.length}`,
        "info",
        `В публичных сертификатах (crt.sh) видны поддомены, которые резолвятся в DNS: ${subdomains.slice(0, 8).join(", ")}${subdomains.length > 8 ? " и др." : ""}. Атакующие используют такой список для поиска забытых стейджингов и админок.`,
        `crt.sh + DNS: резолвятся ${subdomains.length} из ${candidates.length} кандидатов (${subdomains.slice(0, 5).join(", ")})`,
        "Пройдитесь по списку: каждый поддомен должен быть либо обслуживаемым и защищённым, либо выключенным (и убранным из DNS)."
      )
    );
  }

  return { subdomains, findings, degradations: [] };
}

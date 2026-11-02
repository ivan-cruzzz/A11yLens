/**
 * Проверка CVE во фронтенд-библиотеках через бесплатный OSV API
 * (api.osv.dev, без ключей). Версии приходят из инвентаря технологий;
 * недоступность OSV — деградация с пометкой, скан не падает.
 */

import type { LibraryInfo, NativeFinding, Technology } from "./types";

export const OSV_BASE = "https://api.osv.dev";
const MAX_VULNS_PER_LIBRARY = 3;

export interface OsvResponseLite {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type OsvFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<OsvResponseLite>;

export interface CveDeps {
  fetch?: OsvFetch;
}

export interface CveResult {
  findings: NativeFinding[];
  degradations: string[];
}

interface OsvVulnRef {
  id: string;
  aliases?: string[];
  summary?: string;
}

const finding = (
  id: string,
  title: string,
  severity: NativeFinding["severity"],
  detail: string,
  evidence: string,
  recommendation: string
): NativeFinding => ({ id, title, severity, detail, evidence, recommendation });

/** В OSV проверяем только то, что похоже на npm-пакет с чистой semver-версией. */
export function librariesFromTechnologies(
  technologies: readonly Technology[]
): LibraryInfo[] {
  const semver = /^\d+(\.\d+){0,3}$/;
  const out: LibraryInfo[] = [];
  for (const tech of technologies) {
    if (!tech.version || !semver.test(tech.version)) {
      continue;
    }
    out.push({ name: tech.name.toLowerCase(), version: tech.version });
  }
  return out;
}

/**
 * Реальный клиент OSV: глобальный fetch, обёрнутый в нужную сигнатуру.
 */
export async function fetchOsv(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<OsvResponseLite> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body,
  });
  return { ok: response.ok, status: response.status, json: () => response.json() };
}

export async function checkLibraryCves(
  libraries: readonly LibraryInfo[],
  deps: CveDeps = {}
): Promise<CveResult> {
  const doFetch = deps.fetch ?? fetchOsv;
  // Без чистой semver-версии диапазоны OSV не сверить — такие не отправляем.
  const semver = /^\d+(\.\d+){0,3}$/;
  const packageName = /^[@\w./-]+$/;
  const queryable = libraries.filter(
    (lib) => semver.test(lib.version) && packageName.test(lib.name)
  );
  if (queryable.length === 0) {
    return { findings: [], degradations: [] };
  }

  const degraded = (reason: string): CveResult => ({
    findings: [
      finding(
        "ncve-osv-unavailable",
        "Проверка CVE не выполнена: OSV недоступен",
        "info",
        `База уязвимостей OSV не ответила (${reason}) — уязвимые версии библиотек могли остаться незамеченными.`,
        `запрос к ${OSV_BASE} не удался`,
        "Повторите скан позже или сверьте версии библиотек с базой osv.dev вручную."
      ),
    ],
    degradations: [`OSV api.osv.dev недоступен (${reason}) — проверка CVE пропущена`],
  });

  let batchPayload: unknown;
  try {
    const response = await doFetch(`${OSV_BASE}/v1/querybatch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queries: queryable.map((lib) => ({
          package: { name: lib.name, ecosystem: "npm" },
          version: lib.version,
        })),
      }),
    });
    if (!response.ok) {
      return degraded(`ответ ${response.status}`);
    }
    batchPayload = await response.json();
  } catch (error) {
    return degraded(error instanceof Error ? error.message : String(error));
  }

  const results = (batchPayload as { results?: { vulns?: { id: string }[] }[] })
    ?.results;
  if (!Array.isArray(results)) {
    return degraded("неожиданный формат ответа");
  }

  const findings: NativeFinding[] = [];
  for (let index = 0; index < queryable.length; index += 1) {
    const lib = queryable[index];
    const vulnIds = (results[index]?.vulns ?? [])
      .map((vuln) => vuln.id)
      .filter((id): id is string => Boolean(id))
      .slice(0, MAX_VULNS_PER_LIBRARY);
    if (vulnIds.length === 0) {
      continue;
    }

    // Детали каждой уязвимости — ради CVE-псевдонима; сбой деталей не фатален.
    const refs: OsvVulnRef[] = [];
    await Promise.all(
      vulnIds.map(async (id) => {
        try {
          const response = await doFetch(`${OSV_BASE}/v1/vulns/${encodeURIComponent(id)}`);
          if (!response.ok) {
            return;
          }
          const payload = (await response.json()) as OsvVulnRef;
          refs.push({ id, aliases: payload.aliases, summary: payload.summary });
        } catch {
          refs.push({ id });
        }
      })
    );

    const cveIds = refs
      .flatMap((ref) => ref.aliases ?? [])
      .filter((alias) => alias.startsWith("CVE-"));
    const shownIds = cveIds.length > 0 ? cveIds : refs.map((ref) => ref.id);
    const primary = shownIds[0];
    const links = shownIds
      .map((id) => `https://osv.dev/vulnerability/${id}`)
      .join(", ");
    const summaryLine = refs
      .map((ref) => ref.summary)
      .filter(Boolean)
      .slice(0, 2)
      .join("; ");

    findings.push(
      finding(
        `ncve-${lib.name}`,
        `Уязвимые версии ${lib.name} (OSV)`,
        "high",
        `На странице используется ${lib.name} ${lib.version}, для этой версии OSV находит уязвимости: ${shownIds.join(", ")}${summaryLine ? ` (${summaryLine})` : ""}.`,
        `OSV querybatch: ${lib.name}@${lib.version} → ${vulnIds.join(", ")}`,
        `Обновите ${lib.name} до версии без известных уязвимостей. Ссылки: ${links}`
      )
    );
  }

  return { findings, degradations: [] };
}

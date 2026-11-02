/**
 * Почтовая безопасность домена через DNS TXT (node:dns): SPF, DMARC, DKIM.
 * DNS-запросы кешируются на время скана — createTxtCache переиспользуется
 * между проверками одного запуска.
 */

import { promises as dns } from "node:dns";
import type { NativeFinding } from "./types";

/** Типовые селекторы DKIM; перебор записей DNS — не брутфорс. */
export const DKIM_SELECTORS: readonly string[] = [
  "default",
  "google",
  "selector1",
  "selector2",
  "k1",
  "s1",
  "dkim",
  "mail",
];

export type TxtResolver = (name: string) => Promise<string[]>;

export interface TxtCache {
  resolveTxt: TxtResolver;
  /** Сколько имён закешировано (для диагностики). */
  size(): number;
}

export interface EmailDeps {
  resolveTxt?: TxtResolver;
}

export interface EmailResult {
  findings: NativeFinding[];
}

const finding = (
  id: string,
  title: string,
  severity: NativeFinding["severity"],
  detail: string,
  evidence: string,
  recommendation: string
): NativeFinding => ({ id, title, severity, detail, evidence, recommendation });

/**
 * Кеш DNS-ответов на время скана: одно имя запрашивается не больше раза,
 * сбои тоже кешируются (повторять заведомо падающий запрос незачем).
 */
export function createTxtCache(underlying: TxtResolver): TxtCache {
  const cache = new Map<string, Promise<string[]>>();
  return {
    resolveTxt(name: string): Promise<string[]> {
      const cached = cache.get(name);
      if (cached) {
        return cached;
      }
      const pending = underlying(name);
      cache.set(name, pending);
      return pending;
    },
    size: () => cache.size,
  };
}

/** Реальный резолвер TXT: записи сглаживаются в строки. */
export async function resolveTxtDns(name: string): Promise<string[]> {
  const records = await dns.resolveTxt(name);
  return records.map((chunks) => chunks.join(""));
}

async function safeResolve(
  resolveTxt: TxtResolver,
  name: string
): Promise<string[]> {
  try {
    return await resolveTxt(name);
  } catch {
    return [];
  }
}

export async function auditEmailSecurity(
  domain: string,
  deps: EmailDeps = {}
): Promise<EmailResult> {
  const resolveTxt = deps.resolveTxt ?? resolveTxtDns;
  const findings: NativeFinding[] = [];

  // ── SPF: TXT на самом домене ────────────────────────────────────────────────
  const spfRecords = (await safeResolve(resolveTxt, domain)).filter((record) =>
    /^v=spf1(\s|$)/i.test(record.trim())
  );
  if (spfRecords.length === 0) {
    findings.push(
      finding(
        "nmail-no-spf",
        "Нет SPF-записи",
        "medium",
        `У домена ${domain} нет SPF — любой сервер может отправлять письма «от имени» вашего домена, и они будут выглядеть легитимно.`,
        `TXT ${domain}: записей v=spf1 не найдено`,
        "Опубликуйте SPF, например: v=spf1 include:_spf.example.com ~all — со всеми сервисами, которые шлют почту от вашего имени."
      )
    );
  } else if (spfRecords.some((record) => /\+all\b/i.test(record))) {
    const record = spfRecords.find((item) => /\+all\b/i.test(item)) ?? "";
    findings.push(
      finding(
        "nmail-spf-all",
        "SPF разрешает любого отправителя (+all)",
        "high",
        "Механизм +all означает «может отправлять кто угодно» — SPF фактически выключен, подделка писем от вашего домена ничем не ограничена.",
        `TXT ${domain}: ${record}`,
        "Уберите +all из SPF и перечислите только реальные источники почты; на конце поставьте ~all или -all."
      )
    );
  } else if (spfRecords.some((record) => /\?all\b/i.test(record))) {
    findings.push(
      finding(
        "nmail-spf-weak",
        "SPF в нейтральном режиме (?all)",
        "low",
        "Квалификатор ?all не запрещает подделку писем — проверка SPF фактически ни на что не влияет.",
        `TXT ${domain}: ${spfRecords[0]}`,
        "Замените ?all на ~all (softfail) или -all (fail), когда убедитесь, что все легитимные источники перечислены."
      )
    );
  }

  // ── DMARC: TXT на _dmarc.<domain> ───────────────────────────────────────────
  const dmarcRecords = (
    await safeResolve(resolveTxt, `_dmarc.${domain}`)
  ).filter((record) => /^v=DMARC1(\s|;|$)/i.test(record.trim()));
  if (dmarcRecords.length === 0) {
    findings.push(
      finding(
        "nmail-no-dmarc",
        "Нет DMARC-политики",
        "medium",
        `У ${domain} нет DMARC — почтовые серверы не знают, что делать с письмами, не прошедшими SPF/DKIM, и фишинг «от вашего имени» доходит до получателей.`,
        `TXT _dmarc.${domain}: записей v=DMARC1 не найдено`,
        "Опубликуйте DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com (начните с p=none и отчётами, затем ужесточите)."
      )
    );
  } else {
    const policy = /;\s*p=(\w+)/i.exec(dmarcRecords[0])?.[1]?.toLowerCase();
    if (policy === "none") {
      findings.push(
        finding(
          "nmail-dmarc-none",
          "DMARC в режиме мониторинга (p=none)",
          "low",
          "p=none не защищает: поддельные письма доставляются как обычно. Политика есть, но ничего не запрещает.",
          `TXT _dmarc.${domain}: ${dmarcRecords[0]}`,
          "Когда отчёты покажут, что легитимные письма проходят SPF/DKIM, поднимите политику до p=quarantine, затем p=reject."
        )
      );
    }
  }

  // ── DKIM: TXT на <selector>._domainkey.<domain> ────────────────────────────
  const dkimChecks = await Promise.all(
    DKIM_SELECTORS.map(async (selector) => {
      const name = `${selector}._domainkey.${domain}`;
      const records = await safeResolve(resolveTxt, name);
      const key = records.find((record) =>
        /^v=DKIM1(\s|;|$)/i.test(record.trim()) || /(^|;)\s*p=[A-Za-z0-9+/]+=*/.test(record)
      );
      return key ? { selector, name, record: key } : null;
    })
  );
  const dkim = dkimChecks.find((hit) => hit !== null);
  if (!dkim) {
    findings.push(
      finding(
        "nmail-no-dkim",
        "DKIM-подпись не найдена",
        "low",
        `Ни на одном из типовых селекторов (${DKIM_SELECTORS.map((s) => `${s}._domainkey`).join(", ")}) нет ключа DKIM — письма домена сложнее отличить от подделок, а DMARC без DKIM опирается только на SPF.`,
        `проверены: ${DKIM_SELECTORS.map((s) => `${s}._domainkey.${domain}`).join(", ")} — TXT не найдены`,
        "Включите DKIM-подпись в почтовом сервисе и опубликуйте публичный ключ в DNS (обычно он включается одной галочкой)."
      )
    );
  }

  return { findings };
}

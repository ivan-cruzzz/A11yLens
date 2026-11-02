/**
 * TLS-аудит через node:tls (без браузера): срок и валидность сертификата,
 * совпадение имени, разрешены ли устаревшие протоколы TLS 1.0/1.1.
 */

import tls from "node:tls";
import type { NativeFinding } from "./types";

export const EXPIRY_WARNING_DAYS = 30;
export const LEGACY_MAX_VERSION = "TLSv1.1" as const;

export interface TlsCertInfo {
  /** Дата окончания срока в формате сертификата, напр. "Nov  2 12:00:00 2027 GMT". */
  validTo: string;
  subjectCN?: string;
  issuerCN?: string;
  /** DNS-имена из SAN (subjectaltname). */
  altNames: string[];
}

export interface TlsProbeOutcome {
  /** TLS-рукопожатие состоялось (даже если сертификат не прошёл проверку). */
  handshake: boolean;
  /** Согласованная версия протокола, напр. "TLSv1.3". */
  protocol?: string;
  /** Цепочка сертификата прошла проверку против доверенных CA. */
  authorized?: boolean;
  authorizationError?: string;
  cert?: TlsCertInfo;
  /** Причина неудачи рукопожатия. */
  error?: string;
}

export interface TlsProbeOptions {
  /** Ограничить версию сверху — для пробы старых протоколов. */
  maxVersion?: typeof LEGACY_MAX_VERSION;
  timeoutMs: number;
}

export type TlsProbeFn = (
  host: string,
  options: TlsProbeOptions
) => Promise<TlsProbeOutcome>;

export interface TlsAuditDeps {
  probe?: TlsProbeFn;
  now?: () => Date;
}

const finding = (
  id: string,
  title: string,
  severity: NativeFinding["severity"],
  detail: string,
  evidence: string,
  recommendation: string
): NativeFinding => ({ id, title, severity, detail, evidence, recommendation });

/** Wildcard "*.example.com" покрывает ровно один уровень поддоменов. */
function certCoversHost(host: string, cert: TlsCertInfo): boolean {
  const candidates = [cert.subjectCN, ...cert.altNames]
    .filter((name): name is string => Boolean(name))
    .map((name) => name.toLowerCase().trim());
  const target = host.toLowerCase();
  return candidates.some(
    (candidate) =>
      candidate === target ||
      (candidate.startsWith("*.") && target.endsWith(`.${candidate.slice(2)}`))
  );
}

const LEGACY_PROTOCOLS = new Set(["TLSv1", "TLSv1.1"]);

/**
 * Логика аудита по результатам двух проб: обычное рукопожатие +
 * проба с ограничением maxVersion=TLSv1.1 (принимает ли сервер старое).
 */
export async function auditTls(
  host: string,
  deps: TlsAuditDeps = {}
): Promise<NativeFinding[]> {
  const probe = deps.probe ?? probeTls;
  const now = deps.now ?? (() => new Date());

  const main = await probe(host, { timeoutMs: 8000 });
  if (!main.handshake) {
    return [
      finding(
        "ntls-no-tls",
        "TLS-соединение не установлено",
        "high",
        `Порт 443 не отвечает рукопожатием TLS — данные пойдут по HTTP без шифрования, посетители и поисковики видят предупреждение.`,
        main.error ?? "рукопожатие не состоялось",
        "Установите TLS-сертификат и включите HTTPS (Let's Encrypt выдаёт бесплатно; на хостинге обычно есть кнопка)."
      ),
    ];
  }

  const findings: NativeFinding[] = [];

  if (main.protocol && LEGACY_PROTOCOLS.has(main.protocol)) {
    findings.push(
      finding(
        "ntls-old-protocol",
        "Соединение согласовано по устаревшему протоколу",
        "high",
        `Сервер согласовал ${main.protocol} — протоколы ниже TLS 1.2 считаются небезопасными и не проходят PCI DSS.`,
        `согласованный протокол: ${main.protocol}`,
        "Отключите TLS 1.0 и TLS 1.1 на сервере, оставьте только TLS 1.2 и TLS 1.3."
      )
    );
  }

  const cert = main.cert;
  if (!cert) {
    findings.push(
      finding(
        "ntls-no-cert",
        "Сервер не предъявил сертификат",
        "high",
        "Рукопожатие прошло, но сертификат получить не удалось — проверить срок и имя нельзя.",
        `protocol: ${main.protocol ?? "неизвестно"}`,
        "Проверьте настройку TLS на сервере: сертификат должен отдаваться в рукопожатии."
      )
    );
    return findings;
  }

  if (main.authorized === false) {
    const error = main.authorizationError ?? "";
    if (/SELF_SIGNED/i.test(error)) {
      findings.push(
        finding(
          "ntls-self-signed",
          "Самоподписанный сертификат",
          "high",
          "Сертификат подписан самим сервером — браузеры не доверяют ему, посетители видят предупреждение и могут уйти.",
          `ошибка проверки: ${error || "self-signed"}; issuer: ${cert.issuerCN ?? "неизвестно"}`,
          "Выпустите сертификат от доверенного центра (Let's Encrypt) — самоподписанный годится только для локальной разработки."
        )
      );
    } else {
      findings.push(
        finding(
          "ntls-untrusted",
          "Сертификат не проходит проверку доверия",
          "high",
          "Цепочка сертификата не подтверждается доверенным центром — соединение можно перехватить.",
          `ошибка проверки: ${error || "unknown"}`,
          "Установите полную цепочку (промежуточные сертификаты) на сервере и перевыпустите сертификат при необходимости."
        )
      );
    }
  }

  const validTo = new Date(cert.validTo);
  if (!Number.isNaN(validTo.getTime())) {
    const msLeft = validTo.getTime() - now().getTime();
    const daysLeft = Math.round(msLeft / 86_400_000);
    if (msLeft < 0) {
      findings.push(
        finding(
          "ntls-expired",
          "Сертификат истёк",
          "high",
          `Срок действия сертификата истёк ${Math.abs(daysLeft)} дн. назад — браузеры блокируют доступ с предупреждением.`,
          `действителен до: ${cert.validTo}`,
          "Срочно перевыпустите сертификат и включите автопродление (certbot renew / панель хостинга)."
        )
      );
    } else if (daysLeft <= EXPIRY_WARNING_DAYS) {
      findings.push(
        finding(
          "ntls-expiring",
          "Сертификат скоро истечёт",
          "medium",
          `До конца срока сертификата осталось ${daysLeft} дн. — если продление сорвётся, сайт «отвалится» с предупреждением.`,
          `действителен до: ${cert.validTo} (осталось ${daysLeft} дн.)`,
          "Проверьте автопродление сертификата; для Let's Encrypt — запустите certbot renew в тестовом режиме."
        )
      );
    }
  }

  if (!certCoversHost(host, cert)) {
    findings.push(
      finding(
        "ntls-name-mismatch",
        "Имя сайта не совпадает с сертификатом",
        "high",
        `Сертификат выдан не для ${host} — браузер покажет ошибку «Ваше подключение не защищено».`,
        `SAN/CN: ${[cert.subjectCN, ...cert.altNames].filter(Boolean).join(", ") || "не распознаны"}`,
        "Перевыпустите сертификат с нужным именем (или wildcard, если поддоменов несколько)."
      )
    );
  }

  // Проба старых протоколов: согласуется ли сервер на TLS 1.1 и ниже.
  const legacy = await probe(host, { maxVersion: LEGACY_MAX_VERSION, timeoutMs: 8000 });
  if (legacy.handshake) {
    findings.push(
      finding(
        "ntls-legacy-enabled",
        "Сервер принимает устаревшие протоколы TLS 1.0/1.1",
        "high",
        "Сервер соглашается на TLS 1.0/1.1 — эти протоколы взломоопасны (POODLE и др.) и не проходят PCI DSS.",
        `пробное рукопожатие с maxVersion=${LEGACY_MAX_VERSION} удалось${legacy.protocol ? `: ${legacy.protocol}` : ""}`,
        "Отключите на сервере TLS 1.0 и TLS 1.1 (nginx: ssl_protocols TLSv1.2 TLSv1.3)."
      )
    );
  }

  return findings;
}

// ── Реальная проба через node:tls ────────────────────────────────────────────

interface PeerCertificateLike {
  valid_to?: string;
  subject?: { CN?: string | string[] };
  issuer?: { CN?: string | string[] };
  subjectaltname?: string;
}

const firstCn = (cn: string | string[] | undefined): string | undefined =>
  Array.isArray(cn) ? cn[0] : cn;

function parseCert(cert: PeerCertificateLike): TlsCertInfo {
  return {
    validTo: cert.valid_to ?? "",
    subjectCN: firstCn(cert.subject?.CN),
    issuerCN: firstCn(cert.issuer?.CN),
    altNames: (cert.subjectaltname ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith("DNS:"))
      .map((entry) => entry.slice(4)),
  };
}

/**
 * Рукопожатие TLS на порт 443. rejectUnauthorized отключён сознательно:
 * аудит должен увидеть сертификат и ошибку проверки, а не только отказ.
 */
export function probeTls(
  host: string,
  options: TlsProbeOptions
): Promise<TlsProbeOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (outcome: TlsProbeOutcome) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(outcome);
    };

    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false,
        ...(options.maxVersion
          ? { minVersion: "TLSv1", maxVersion: options.maxVersion }
          : {}),
        timeout: options.timeoutMs,
      },
      () => {
        const cert = socket.getPeerCertificate();
        done({
          handshake: true,
          protocol: socket.getProtocol() ?? undefined,
          authorized: socket.authorized,
          authorizationError: socket.authorizationError
            ? String(socket.authorizationError)
            : undefined,
          cert: cert && Object.keys(cert).length > 0 ? parseCert(cert) : undefined,
        });
      }
    );
    socket.on("error", (error: Error) => {
      done({ handshake: false, error: error.message });
    });
    socket.on("timeout", () => {
      done({
        handshake: false,
        error: `TLS-рукопожатие не уложилось в ${options.timeoutMs} мс`,
      });
    });
  });
}

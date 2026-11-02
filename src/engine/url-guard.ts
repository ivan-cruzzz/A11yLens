/**
 * Нормализация и SSRF-фильтр целевого адреса.
 * Файл без Next-зависимостей: используется API-роутом и CLI.
 */

import { promises as dns } from "node:dns";

export interface NormalizeUrlOptions {
  /**
   * Разрешить приватные/локальные адреса (self-scan, локальная разработка).
   * Продакшн-роут никогда не передаёт этот флаг.
   */
  allowPrivateNetwork?: boolean;
}

// ── Разбор IPv4 в любой нотации (семантика inet_aton) ────────────────────────

const parseIpPart = (part: string): number | null => {
  if (/^0[xX][0-9a-fA-F]+$/.test(part)) {
    return parseInt(part.slice(2), 16);
  }
  if (/^0[0-7]*$/.test(part)) {
    return parseInt(part, 8);
  }
  if (/^[0-9]+$/.test(part)) {
    return parseInt(part, 10);
  }
  return null;
};

/**
 * IPv4-подобный хост в десятичной, восьмеричной, шестнадцатеричной
 * или сокращённой записи (127.1, 2130706433, 0177.0.0.1, 0x7f000001)
 * → четыре октета; иначе null (обычное DNS-имя).
 */
function parseIpv4Loose(
  host: string
): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length < 1 || parts.length > 4) {
    return null;
  }
  const nums: number[] = [];
  for (const part of parts) {
    const n = parseIpPart(part);
    if (n === null || !Number.isSafeInteger(n)) {
      return null;
    }
    nums.push(n);
  }
  let value: number;
  if (nums.length === 4) {
    if (nums.some((n) => n > 0xff)) {
      return null;
    }
    value = ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
  } else if (nums.length === 3) {
    if (nums[0] > 0xff || nums[1] > 0xff || nums[2] > 0xffff) {
      return null;
    }
    value = ((nums[0] << 24) | (nums[1] << 16) | nums[2]) >>> 0;
  } else if (nums.length === 2) {
    if (nums[0] > 0xff || nums[1] > 0xffffff) {
      return null;
    }
    value = ((nums[0] << 24) | nums[1]) >>> 0;
  } else {
    if (nums[0] > 0xffffffff) {
      return null;
    }
    value = nums[0] >>> 0;
  }
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function isBlockedIpv4(o: readonly number[]): boolean {
  return (
    o[0] === 0 || // «this network» / 0.0.0.0
    o[0] === 10 || // приватная 10/8
    o[0] === 127 || // loopback
    (o[0] === 100 && o[1] >= 64 && o[1] <= 127) || // CGNAT + метаданные Alibaba 100.100.100.200
    (o[0] === 169 && o[1] === 254) || // link-local + метаданные AWS/GCP/Azure/Azure 169.254.169.254
    (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || // приватная 172.16/12
    (o[0] === 192 && o[1] === 168) || // приватная 192.168/16
    o[0] >= 224 // multicast / reserved / broadcast
  );
}

// ── Разбор IPv6 ──────────────────────────────────────────────────────────────

function parseIpv6Groups(host: string): number[] | null {
  let h = host;
  const v4tail = h.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4tail) {
    const octets = parseIpv4Loose(v4tail[2]);
    if (!octets) {
      return null;
    }
    h =
      v4tail[1] +
      (((octets[0] << 8) | octets[1]).toString(16) +
        ":" +
        ((octets[2] << 8) | octets[3]).toString(16));
  }
  const halves = h.split("::");
  if (halves.length > 2) {
    return null;
  }
  const parseGroups = (s: string): number[] | null => {
    if (s === "") {
      return [];
    }
    const groups: number[] = [];
    for (const g of s.split(":")) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) {
        return null;
      }
      groups.push(parseInt(g, 16));
    }
    return groups;
  };
  const head = parseGroups(halves[0]);
  const tail = halves.length === 2 ? parseGroups(halves[1]) : null;
  if (head === null || tail === null) {
    return null;
  }
  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }
  const missing = 8 - head.length - tail.length;
  if (missing < 1) {
    return null;
  }
  return [...head, ...Array.from({ length: missing }, () => 0), ...tail];
}

function isBlockedIpv6(groups: readonly number[]): boolean {
  if (groups.every((g) => g === 0)) {
    return true; // :: (unspecified)
  }
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) {
    return true; // ::1 loopback
  }
  if ((groups[0] & 0xffc0) === 0xfe80) {
    return true; // fe80::/10 link-local
  }
  if ((groups[0] & 0xfe00) === 0xfc00) {
    return true; // fc00::/7 unique-local
  }
  // IPv4-mapped (::ffff:127.0.0.1) и IPv4-compatible (::127.0.0.1).
  const isMapped =
    groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  const isCompatible = groups.slice(0, 6).every((g) => g === 0);
  if (isMapped || isCompatible) {
    const packed = ((groups[6] << 16) | groups[7]) >>> 0;
    return isBlockedIpv4([
      (packed >>> 24) & 0xff,
      (packed >>> 16) & 0xff,
      (packed >>> 8) & 0xff,
      packed & 0xff,
    ]);
  }
  return false;
}

// ── Имена хостов ─────────────────────────────────────────────────────────────

const BLOCKED_HOSTNAMES = new Set(["metadata.goog"]);

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) {
    return true;
  }
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") // в т.ч. metadata.google.internal
  );
}

/** Синтаксическая проверка хоста: буквальные IP в любой записи + имена. */
function isBlockedHost(hostname: string): boolean {
  if (isBlockedHostname(hostname)) {
    return true;
  }
  const bare =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  if (bare.includes(":")) {
    const groups = parseIpv6Groups(bare);
    return groups === null ? false : isBlockedIpv6(groups);
  }
  const v4 = parseIpv4Loose(bare);
  return v4 === null ? false : isBlockedIpv4(v4);
}

// ── Публичные функции ────────────────────────────────────────────────────────

export function normalizeUrl(
  raw: string,
  options: NormalizeUrlOptions = {}
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Укажите адрес страницы");
  }
  // Явная чужая схема (ftp://, file://…) — не дописываем https://, а честно отказываем.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    throw new Error("Поддерживаются только http и https");
  }
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Поддерживаются только http и https");
  }
  if (!options.allowPrivateNetwork && isBlockedHost(url.hostname)) {
    throw new Error("Внутренние адреса не сканируются");
  }
  return url.toString();
}

function isBlockedResolvedAddress(address: string): boolean {
  if (address.includes(":")) {
    const groups = parseIpv6Groups(address);
    return groups === null ? true : isBlockedIpv6(groups);
  }
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    // Неожидаемый формат адреса — закрываемся (fail-closed).
    return true;
  }
  return isBlockedIpv4(octets);
}

/**
 * Проверяет фактический DNS-резолв: домен не должен указывать
 * на приватные/служебные адреса (защита от DNS rebinding).
 * Вызывается после normalizeUrl, перед загрузкой страницы.
 */
export async function assertPublicHttpUrl(url: string): Promise<void> {
  const { hostname } = new URL(url);
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error(
      "Сайт не открылся: проверьте адрес или доступность страницы"
    );
  }
  for (const { address } of addresses) {
    if (isBlockedResolvedAddress(address)) {
      throw new Error("Внутренние адреса не сканируются");
    }
  }
}

import type {
  SecurityAudit,
  SecurityFinding,
  SecuritySeverity,
} from "./types";
import { SEVERITY_ORDER, computeSecurityScore } from "./scoring";

/**
 * Пассивные проверки кибербезопасности по данным одной загрузки страницы:
 * заголовки ответа, куки, mixed content, SRI, утечка версий, безопасные
 * GET-пробы типовых чувствительных файлов и HTTPS-редирект.
 * Никаких активных атак: только чтение ответов на обычные запросы.
 */

type Headers = Record<string, string>;

const lowerHeaders = (headers: Headers): Headers => {
  const map: Headers = {};
  for (const [key, value] of Object.entries(headers)) {
    map[key.toLowerCase()] = value;
  }
  return map;
};

const finding = (
  id: string,
  title: string,
  severity: SecuritySeverity,
  detail: string,
  recommendation: string
): SecurityFinding => ({ id, title, severity, detail, recommendation });

// ── Заголовки ответа ─────────────────────────────────────────────────────────

export function auditHeaders(headers: Headers): SecurityFinding[] {
  const h = lowerHeaders(headers);
  const findings: SecurityFinding[] = [];

  if (!h["content-security-policy"]) {
    findings.push(
      finding(
        "sec-csp",
        "Нет Content-Security-Policy",
        "high",
        "Заголовок CSP отсутствует — браузер не ограничивает источники скриптов, что упрощает эксплуатацию XSS.",
        "Добавьте Content-Security-Policy с whitelist источников: script-src, style-src, default-src 'self'."
      )
    );
  }

  if (!h["strict-transport-security"]) {
    findings.push(
      finding(
        "sec-hsts",
        "Нет Strict-Transport-Security (HSTS)",
        "medium",
        "Браузер не обязан использовать HTTPS для повторных визитов — возможен downgrade и перехват первого запроса.",
        "Отправляйте Strict-Transport-Security: max-age=31536000; includeSubDomains (после проверки, что весь сайт работает по HTTPS)."
      )
    );
  }

  if (
    !h["x-frame-options"] &&
    !(h["content-security-policy"] ?? "").includes("frame-ancestors")
  ) {
    findings.push(
      finding(
        "sec-clickjacking",
        "Страницу можно встроить во фрейм (clickjacking)",
        "medium",
        "Нет ни X-Frame-Options, ни CSP frame-ancestors — страницу можно скрытно встроить на сторонний сайт и перехватывать клики.",
        "Добавьте X-Frame-Options: DENY или CSP: frame-ancestors 'none' (или 'self', если фреймы нужны)."
      )
    );
  }

  if (!h["x-content-type-options"]) {
    findings.push(
      finding(
        "sec-nosniff",
        "Нет X-Content-Type-Options",
        "low",
        "Браузер может «угадать» MIME-тип ответа и исполнить загруженный файл как скрипт.",
        "Добавьте X-Content-Type-Options: nosniff."
      )
    );
  }

  if (!h["referrer-policy"]) {
    findings.push(
      finding(
        "sec-referrer",
        "Нет Referrer-Policy",
        "low",
        "Полный URL (включая пути с токенами) может утекать в Referer при переходах на внешние сайты.",
        "Добавьте Referrer-Policy: strict-origin-when-cross-origin (или no-referrer)."
      )
    );
  }

  if (!h["permissions-policy"]) {
    findings.push(
      finding(
        "sec-permissions",
        "Нет Permissions-Policy",
        "info",
        "Не ограничено использование камеры, микрофона и геолокации во фреймах и встраиваниях.",
        "Добавьте Permissions-Policy, например: camera=(), microphone=(), geolocation=()."
      )
    );
  }

  if (!h["cross-origin-opener-policy"]) {
    findings.push(
      finding(
        "sec-coop",
        "Нет Cross-Origin-Opener-Policy",
        "low",
        "Открытые через window.open кросс-доменные страницы получают доступ к window.opener (spectre-класс атак).",
        "Добавьте Cross-Origin-Opener-Policy: same-origin."
      )
    );
  }

  return findings;
}

// ── Cookies ──────────────────────────────────────────────────────────────────

export interface CookieInfo {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

export function auditCookies(cookies: CookieInfo[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const unsafe = cookies.filter((cookie) => !cookie.secure);
  const noHttpOnly = cookies.filter((cookie) => !cookie.httpOnly);
  const noSameSite = cookies.filter(
    (cookie) => !cookie.sameSite || cookie.sameSite === "None"
  );

  if (unsafe.length > 0) {
    findings.push(
      finding(
        "sec-cookie-secure",
        "Куки без флага Secure",
        "medium",
        `Куки без Secure могут уйти по HTTP: ${unsafe.map((c) => c.name).slice(0, 5).join(", ")}.`,
        "Ставьте всем кукам флаг Secure — передача только по HTTPS."
      )
    );
  }
  if (noHttpOnly.length > 0) {
    findings.push(
      finding(
        "sec-cookie-httponly",
        "Куки без флага HttpOnly",
        "medium",
        `Эти куки читает JavaScript — при XSS их украдут: ${noHttpOnly.map((c) => c.name).slice(0, 5).join(", ")}.`,
        "Для сессионных кук ставьте HttpOnly (кроме тех, что нужны JS на клиенте)."
      )
    );
  }
  if (noSameSite.length > 0) {
    findings.push(
      finding(
        "sec-cookie-samesite",
        "Куки без SameSite",
        "low",
        `Без SameSite куки уходят в кросс-сайтовые запросы (CSRF): ${noSameSite.map((c) => c.name).slice(0, 5).join(", ")}.`,
        "Ставьте SameSite=Lax (или Strict для чувствительных действий)."
      )
    );
  }
  return findings;
}

// ── Mixed content ────────────────────────────────────────────────────────────

export function auditMixedContent(
  pageIsHttps: boolean,
  insecureResourceUrls: string[]
): SecurityFinding[] {
  if (!pageIsHttps || insecureResourceUrls.length === 0) {
    return [];
  }
  return [
    finding(
      "sec-mixed-content",
      "Mixed content: HTTP-ресурсы на HTTPS-странице",
      "high",
      `Небезопасных ресурсов ${insecureResourceUrls.length} шт. — их можно подменить по пути, например: ${insecureResourceUrls.slice(0, 3).join(", ")}.`,
      "Загружайте все скрипты, стили и картинки по HTTPS."
    ),
  ];
}

// ── SRI у внешних скриптов ───────────────────────────────────────────────────

export function auditSri(
  externals: { src: string; hasIntegrity: boolean }[]
): SecurityFinding[] {
  const missing = externals.filter((item) => !item.hasIntegrity);
  if (missing.length === 0) {
    return [];
  }
  return [
    finding(
      "sec-sri",
      "Внешние скрипты без Subresource Integrity",
      "medium",
      `Скрипты с чужих доменов без атрибута integrity (${missing.length} шт.) — при компрометации CDN вам подсунут чужой код, например: ${missing.map((s) => s.src).slice(0, 2).join(", ")}.`,
      "Добавляйте crossorigin=\"anonymous\" integrity=\"sha384-…\" ко внешним <script> и <link rel=stylesheet> с неизменяемыми версиями."
    ),
  ];
}

// ── Утечка версий ────────────────────────────────────────────────────────────

export function auditVersionDisclosure(input: {
  poweredBy?: string;
  generator?: string;
  jqueryVersion?: string;
}): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const leaks: string[] = [];
  if (input.poweredBy) {
    leaks.push(`X-Powered-By: ${input.poweredBy}`);
  }
  if (input.generator) {
    leaks.push(`meta generator: ${input.generator}`);
  }
  if (leaks.length > 0) {
    findings.push(
      finding(
        "sec-version-disclosure",
        "Раскрытие версий серверных технологий",
        "low",
        `Ответ отдаёт версии платформы: ${leaks.join("; ")}. Это упрощает подбор эксплойтов под конкретную версию.`,
        "Скройте X-Powered-By, уберите meta generator из шаблонов."
      )
    );
  }
  if (input.jqueryVersion) {
    const [major, minor = "0"] = input.jqueryVersion.split(".");
    const outdated =
      Number(major) < 3 || (Number(major) === 3 && Number(minor) < 5);
    findings.push(
      finding(
        "sec-jquery-version",
        outdated
          ? "Устаревший jQuery с известными уязвимостями"
          : "jQuery: версия раскрыта на странице",
        outdated ? "medium" : "info",
        `На странице jQuery ${input.jqueryVersion}.${outdated ? " Версии ниже 3.5.0 уязвимы к XSS (CVE-2020-11022/11023)." : ""}`,
        outdated
          ? "Обновите jQuery минимум до 3.5.0+ или откажитесь от него."
          : "Если jQuery не нужен публично — не оставляйте его загрузку на продакшене."
      )
    );
  }
  return findings;
}

// ── HTTPS-редирект ───────────────────────────────────────────────────────────

export async function auditHttpsRedirect(
  hostname: string
): Promise<SecurityFinding[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`http://${hostname}/`, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "A11yLens-security-audit" },
    });
    clearTimeout(timer);
    const location = response.headers.get("location") ?? "";
    const redirectsToHttps =
      [301, 302, 308].includes(response.status) &&
      location.startsWith("https://");
    if (redirectsToHttps) {
      return [];
    }
    return [
      finding(
        "sec-https-redirect",
        "HTTP не перенаправляет на HTTPS",
        "medium",
        `Запрос http://${hostname}/ вернул ${response.status} без редиректа на HTTPS — первый запрос можно перехватить.`,
        "Настройте 301-редирект с HTTP на HTTPS на уровне сервера/хостинга."
      ),
    ];
  } catch {
    // HTTP-порт недоступен — значит и перехватывать нечего.
    return [];
  }
}

// ── Пробы чувствительных файлов (безопасные GET) ─────────────────────────────

const SENSITIVE_PATHS: {
  path: string;
  id: string;
  title: string;
  severity: SecuritySeverity;
  match?: RegExp;
  recommendation: string;
}[] = [
  {
    path: "/.git/HEAD",
    id: "sec-git-exposed",
    title: "Открыт каталог .git",
    severity: "high",
    match: /ref:/,
    recommendation:
      "Запретите доступ к .git на веб-сервере — по нему восстанавливается весь исходный код и история коммитов.",
  },
  {
    path: "/.env",
    id: "sec-env-exposed",
    title: "Доступен файл .env",
    severity: "high",
    match: /(^|\n)[A-Z_]+=|\bDB_PASSWORD\b/,
    recommendation:
      "Уберите .env из веб-корня и запретите его отдачу — в нём обычно лежат пароли и ключи API.",
  },
  {
    path: "/phpinfo.php",
    id: "sec-phpinfo",
    title: "Доступен phpinfo.php",
    severity: "medium",
    match: /phpinfo\(\)|PHP Version/i,
    recommendation:
      "Удалите phpinfo.php с продакшена — он раскрывает конфигурацию сервера.",
  },
  {
    path: "/wp-config.php.bak",
    id: "sec-backup-config",
    title: "Доступна резервная копия конфигурации",
    severity: "high",
    match: /DB_PASSWORD|DB_HOST|define\(/,
    recommendation:
      "Удалите .bak-копии конфигов с сервера; бэкапы — вне веб-корня.",
  },
  {
    path: "/.DS_Store",
    id: "sec-dsstore",
    title: "Доступен .DS_Store",
    severity: "low",
    match: /\x00Bud1|Bud1/,
    recommendation:
      "Удалите .DS_Store с сервера и исключите из деплоя — раскрывает структуру каталогов.",
  },
];

export async function probeSensitiveFiles(
  origin: string
): Promise<SecurityFinding[]> {
  // Пробы независимы — идут параллельно, суммарное время = худшей пробе,
  // а не сумме всех.
  const results = await Promise.all(
    SENSITIVE_PATHS.map(async (probe): Promise<SecurityFinding | null> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(`${origin}${probe.path}`, {
          redirect: "manual",
          signal: controller.signal,
          headers: { "user-agent": "A11yLens-security-audit" },
        });
        clearTimeout(timer);
        if (response.status >= 300 && response.status < 400) {
          // Редирект не проверяем: сканируемый сайт может 302-м увести пробу
          // на внутренний адрес (SSRF), а фильтр смотрит только исходный хост.
          // Тело редиректа не читаем — это не evidence нашего сайта.
          return null;
        }
        if (!response.ok) {
          return null;
        }
        const body = (await response.text()).slice(0, 4096);
        if (!probe.match || probe.match.test(body)) {
          return finding(
            probe.id,
            probe.title,
            probe.severity,
            `GET ${probe.path} отвечает ${response.status} с ожидаемым содержимым.`,
            probe.recommendation
          );
        }
        return null;
      } catch {
        // Сетевая ошибка/таймаут — проба не удалась, не находка.
        return null;
      }
    })
  );
  return results.filter(
    (item): item is SecurityFinding => item !== null
  );
}

// ── Реестр проверок ──────────────────────────────────────────────────────────

export type SecurityCheckArea =
  | "headers"
  | "cookies"
  | "page"
  | "versions"
  | "network"
  | "probes";

export interface SecurityCheckMeta {
  /** id находки, которую выдаёт проверка. */
  id: string;
  area: SecurityCheckArea;
  /** Короткое имя проверки для списков в UI. */
  title: string;
}

/**
 * Реестр всех security-проверок — единственный источник для
 * `checksRun` и для списка проверок в UI. Никакого хардкода количества.
 */
export const SECURITY_CHECKS: readonly SecurityCheckMeta[] = [
  { id: "sec-csp", area: "headers", title: "Content-Security-Policy" },
  { id: "sec-hsts", area: "headers", title: "Strict-Transport-Security" },
  {
    id: "sec-clickjacking",
    area: "headers",
    title: "X-Frame-Options / frame-ancestors",
  },
  { id: "sec-nosniff", area: "headers", title: "X-Content-Type-Options" },
  { id: "sec-referrer", area: "headers", title: "Referrer-Policy" },
  { id: "sec-permissions", area: "headers", title: "Permissions-Policy" },
  { id: "sec-coop", area: "headers", title: "Cross-Origin-Opener-Policy" },
  { id: "sec-cookie-secure", area: "cookies", title: "Куки: флаг Secure" },
  { id: "sec-cookie-httponly", area: "cookies", title: "Куки: флаг HttpOnly" },
  { id: "sec-cookie-samesite", area: "cookies", title: "Куки: SameSite" },
  { id: "sec-mixed-content", area: "page", title: "Mixed content" },
  { id: "sec-sri", area: "page", title: "Subresource Integrity" },
  {
    id: "sec-version-disclosure",
    area: "versions",
    title: "Раскрытие версий",
  },
  { id: "sec-jquery-version", area: "versions", title: "Версия jQuery" },
  { id: "sec-https-redirect", area: "network", title: "HTTPS-редирект" },
  { id: "sec-git-exposed", area: "probes", title: "Каталог .git" },
  { id: "sec-env-exposed", area: "probes", title: "Файл .env" },
  { id: "sec-phpinfo", area: "probes", title: "phpinfo.php" },
  {
    id: "sec-backup-config",
    area: "probes",
    title: "Резервная копия конфига",
  },
  { id: "sec-dsstore", area: "probes", title: ".DS_Store" },
];

// ── Сборка аудита ────────────────────────────────────────────────────────────

export function buildSecurityAudit(findings: SecurityFinding[]): SecurityAudit {
  return {
    score: computeSecurityScore(findings),
    findings: [...findings].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    ),
    checksRun: SECURITY_CHECKS.length,
  };
}

/**
 * Сбой аудита виден в отчёте строкой ошибки,
 * а не молчаливым исчезновением секции безопасности.
 */
export function failedSecurityAudit(reason: string): SecurityAudit {
  return { score: 0, findings: [], checksRun: 0, error: reason };
}

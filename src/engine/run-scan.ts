/**
 * Конвейер сканирования: Playwright + axe-core + пассивный security-аудит.
 * Без Next-зависимостей — импортируется API-роутом, CLI и десктоп-сборкой.
 */

import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page, type Response } from "playwright";
import { categoryOf } from "../lib/knowledge";
import {
  auditCookies,
  auditHeaders,
  auditHttpsRedirect,
  auditMixedContent,
  auditSri,
  auditVersionDisclosure,
  buildSecurityAudit,
  failedSecurityAudit,
  probeSensitiveFiles,
  type CookieInfo,
} from "./security";
import {
  IMPACT_ORDER,
  computeAccessibilityScore,
} from "./scoring";
import { withTimeout } from "./timeout";
import { assertPublicHttpUrl, normalizeUrl } from "./url-guard";
import type {
  Category,
  Device,
  Impact,
  ScanRequest,
  ScanResult,
  SecurityAudit,
  Standard,
  Violation,
  ViolationNode,
} from "./types";

export type ScanOptions = ScanRequest & {
  /**
   * Разрешить приватные/локальные адреса (self-scan, локальная разработка).
   * Продакшн-роут не передаёт этот флаг.
   */
  allowPrivateNetwork?: boolean;
};

const TAGS_BY_STANDARD: Record<Standard, string[]> = {
  AA: [
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
    "best-practice",
  ],
  AAA: [
    "wcag2a",
    "wcag2aa",
    "wcag2aaa",
    "wcag21a",
    "wcag21aa",
    "wcag21aaa",
    "wcag22aa",
    "best-practice",
  ],
  "508": ["section508", "wcag2a", "wcag2aa", "best-practice"],
};

const VIEWPORTS: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

const MAX_VIOLATIONS = 14;
const MAX_NODES_PER_VIOLATION = 4;
const MAX_ELEMENT_SHOTS = 16;
/** Анализ доступности не может длиться бесконечно (тяжёлые страницы). */
const AXE_ANALYZE_TIMEOUT_MS = 45_000;

async function captureElement(
  page: Page,
  selector: string
): Promise<string | undefined> {
  const locator = page.locator(selector).first();
  try {
    const box = await locator.boundingBox({ timeout: 1500 });
    if (!box || box.width < 2 || box.height < 2) {
      return undefined;
    }
    const shot = await locator.screenshot({
      timeout: 2500,
      animations: "disabled",
      type: "png",
      scale: "css",
    });
    return `data:image/png;base64,${shot.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function rawPageIsFile(pageUrl: string): boolean {
  return pageUrl === "about:blank" || !/^https?:\/\//i.test(pageUrl);
}

/**
 * Пассивный аудит безопасности: данные собраны при загрузке страницы,
 * плюс безопасные GET-пробы и проверка HTTPS-редиректа.
 */
async function securityAudit(
  page: Page,
  response: Response | null,
  pageUrl: string
): Promise<SecurityAudit | undefined> {
  try {
    if (rawPageIsFile(pageUrl)) {
      return undefined;
    }
    if (!response) {
      return failedSecurityAudit(
        "Аудит безопасности не выполнен: страница не отдала HTTP-ответ"
      );
    }
    const url = new URL(pageUrl);
    const pageIsHttps = url.protocol === "https:";
    const headerMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers())) {
      headerMap[key] = value;
    }

    // Куки контекста после загрузки страницы.
    const cookies = await page.context().cookies(pageUrl);
    const cookieInfos: CookieInfo[] = cookies.map((cookie) => ({
      name: cookie.name,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite ?? "Lax",
    }));

    // Mixed content, внешние скрипты без SRI, meta generator, jQuery.
    const pageData = await page.evaluate(() => {
      const resources = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((src) => src.startsWith("http://"));
      const externals = [...document.querySelectorAll("script[src]")]
        .map((script) => ({
          src: (script as HTMLScriptElement).src,
          hasIntegrity: script.hasAttribute("integrity"),
        }))
        .filter((item) => /^https?:\/\//i.test(item.src) && !item.src.startsWith(location.origin));
      const generator = document
        .querySelector<HTMLMetaElement>('meta[name="generator"]')
        ?.content;
      const jqueryVersion = (window as unknown as { jQuery?: { fn?: { jquery?: string } } })
        .jQuery?.fn?.jquery;
      return {
        insecureResources: [...new Set(resources)].slice(0, 10),
        externals: externals.slice(0, 15),
        generator,
        jqueryVersion,
      };
    });

    // Сетевые проверки (редирект + пробы) независимы — идут параллельно.
    const [redirectFindings, probeFindings] = await Promise.all([
      auditHttpsRedirect(url.hostname),
      probeSensitiveFiles(url.origin),
    ]);

    const findings = [
      ...auditHeaders(headerMap),
      ...auditCookies(cookieInfos),
      ...auditMixedContent(pageIsHttps, pageData.insecureResources),
      ...auditSri(pageData.externals),
      ...auditVersionDisclosure({
        poweredBy: headerMap["x-powered-by"],
        generator: pageData.generator,
        jqueryVersion: pageData.jqueryVersion,
      }),
      ...redirectFindings,
      ...probeFindings,
    ];

    // checksRun вычисляется из реестра проверок внутри buildSecurityAudit.
    return buildSecurityAudit(findings);
  } catch (error) {
    // Аудит не должен ломать основной отчёт — но и молчать о сбое:
    // в отчёт уходит строка ошибки.
    const reason = error instanceof Error ? error.message : String(error);
    return failedSecurityAudit(`Аудит безопасности не выполнен: ${reason}`);
  }
}

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const target = options.html
    ? "HTML-файл"
    : normalizeUrl(options.url ?? "", {
        allowPrivateNetwork: options.allowPrivateNetwork,
      });
  let browser: Browser | null = null;
  const startedAt = Date.now();

  // SSRF-фильтр второго уровня: домен не должен резолвиться
  // в приватные адреса (защита от DNS rebinding).
  if (!options.html && !options.allowPrivateNetwork) {
    await assertPublicHttpUrl(target);
  }

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: VIEWPORTS[options.device],
      deviceScaleFactor: 1,
      isMobile: options.device === "mobile",
      locale: "ru-RU",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    let mainResponse: Response | null = null;
    if (options.html) {
      await page.setContent(options.html, { waitUntil: "load" });
    } else {
      mainResponse = await page.goto(target, {
        waitUntil: "load",
        timeout: 30_000,
      });
    }
    // Даём странице отрисоваться (шрифты, ленивые картинки).
    await page.waitForTimeout(1200);

    // Пассивный аудит безопасности — параллельно анализу доступности,
    // ошибка аудита не влияет на отчёт.
    const securityPromise: Promise<SecurityAudit | undefined> = options.html
      ? Promise.resolve(undefined)
      : securityAudit(page, mainResponse, page.url());

    const title = await page.title();
    const builder = new AxeBuilder({ page }).withTags(
      TAGS_BY_STANDARD[options.standard]
    );
    const axeResult = await withTimeout(
      builder.analyze(),
      AXE_ANALYZE_TIMEOUT_MS,
      "Анализ доступности не уложился в отведённое время — страница слишком тяжёлая, попробуйте другую страницу сайта"
    );

    const pageShotBuffer = await page.screenshot({
      fullPage: true,
      type: "jpeg",
      quality: 55,
      animations: "disabled",
    });

    // Скриншоты проблемных элементов (ограничены, чтобы не раздувать ответ).
    const violations: Violation[] = [];
    let elementShots = 0;
    const sorted = [...(axeResult.violations ?? [])]
      .sort(
        (a, b) =>
          (IMPACT_ORDER[(a.impact ?? "minor") as Impact] ?? 3) -
          (IMPACT_ORDER[(b.impact ?? "minor") as Impact] ?? 3)
      )
      .slice(0, MAX_VIOLATIONS);

    for (const violation of sorted) {
      const nodes: ViolationNode[] = [];
      const targets = (violation.nodes ?? []).slice(0, MAX_NODES_PER_VIOLATION);
      for (const node of targets) {
        const selector = String(node.target?.[0] ?? node.html.slice(0, 60));
        let snippet = node.html ?? "";
        if (snippet.length > 160) {
          snippet = `${snippet.slice(0, 157)}…`;
        }
        const entry: ViolationNode = { selector, snippet };
        if (elementShots < MAX_ELEMENT_SHOTS) {
          const shot = await captureElement(page, selector);
          if (shot) {
            entry.screenshot = shot;
            elementShots += 1;
          }
        }
        nodes.push(entry);
      }

      violations.push({
        id: violation.id,
        title: violation.help,
        help: violation.help,
        helpUrl: violation.helpUrl,
        impact: (violation.impact ?? "minor") as Impact,
        category: categoryOf(violation.id),
        tags: violation.tags ?? [],
        nodes,
      });
    }

    const counts = violations.reduce(
      (acc, violation) => {
        acc[violation.category] += 1;
        return acc;
      },
      {
        contrast: 0,
        alt: 0,
        keyboard: 0,
        forms: 0,
        aria: 0,
        other: 0,
      } as Record<Category, number>
    );

    const totalNodes = violations.reduce(
      (sum, violation) => sum + Math.max(violation.nodes.length, 1),
      0
    );
    const score = computeAccessibilityScore(violations);

    const host = options.html
      ? "локальный файл"
      : new URL(target).hostname;
    const security = await securityPromise;

    const pageShot = {
      src: `data:image/jpeg;base64,${pageShotBuffer.toString("base64")}`,
      width: VIEWPORTS[options.device].width,
      height: VIEWPORTS[options.device].height,
      alt: `Скриншот страницы ${host}`,
      caption: "Страница целиком",
    };

    return {
      url: target,
      host,
      scannedAt: new Date().toISOString(),
      standard: options.standard,
      device: options.device,
      score,
      counts,
      totalViolations: violations.length,
      totalNodes,
      meta: {
        title: title || host,
        loadMs: Date.now() - startedAt,
        rulesRun: (axeResult.passes?.length ?? 0) + violations.length,
        passedRules: axeResult.passes?.length ?? 0,
        incompleteRules: axeResult.incomplete?.length ?? 0,
      },
      violations,
      pageScreenshot: pageShot,
      security: security ?? undefined,
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

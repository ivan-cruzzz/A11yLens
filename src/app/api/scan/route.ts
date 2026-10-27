import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page, type Response } from "playwright";
import { NextResponse } from "next/server";
import { categoryOf } from "@/lib/knowledge";
import {
  auditCookies,
  auditHeaders,
  auditHttpsRedirect,
  auditMixedContent,
  auditSri,
  auditVersionDisclosure,
  buildSecurityAudit,
  probeSensitiveFiles,
  type CookieInfo,
} from "@/lib/security";
import {
  IMPACT_WEIGHTS,
  type Category,
  type Device,
  type Impact,
  type ScanRequest,
  type ScanResult,
  type Standard,
  type Violation,
  type ViolationNode,
} from "@/lib/types";

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

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Укажите адрес страницы");
  }
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Поддерживаются только http и https");
  }
  if (
    /^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
      url.hostname
    )
  ) {
    throw new Error("Внутренние адреса не сканируются");
  }
  return url.toString();
}

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

/**
 * Пассивный аудит безопасности: данные собраны при загрузке страницы,
 * плюс безопасные GET-пробы и проверка HTTPS-редиректа.
 */
async function securityAudit(
  page: Page,
  response: Response | null,
  pageUrl: string
) {
  try {
    if (!response || rawPageIsFile(pageUrl)) {
      return undefined;
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
      ...(await auditHttpsRedirect(url.hostname)),
      ...(await probeSensitiveFiles(url.origin)),
    ];

    return buildSecurityAudit(
      findings,
      // Заголовки (7) + куки (3 категории) + mixed + SRI + версии + redirect + пробы.
      7 + 3 + 1 + 1 + 1 + 1 + 5
    );
  } catch {
    // Аудит безопасности не должен ломать основной отчёт.
    return undefined;
  }
}

function rawPageIsFile(pageUrl: string): boolean {
  return pageUrl === "about:blank" || !/^https?:\/\//i.test(pageUrl);
}

async function scan(rawRequest: ScanRequest): Promise<ScanResult> {
  const target = rawRequest.html
    ? "HTML-файл"
    : normalizeUrl(rawRequest.url ?? "");
  let browser: Browser | null = null;
  const startedAt = Date.now();

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: VIEWPORTS[rawRequest.device],
      deviceScaleFactor: 1,
      isMobile: rawRequest.device === "mobile",
      locale: "ru-RU",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    let mainResponse: Response | null = null;
    if (rawRequest.html) {
      await page.setContent(rawRequest.html, { waitUntil: "load" });
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
    const securityPromise = rawRequest.html
      ? Promise.resolve(undefined)
      : securityAudit(page, mainResponse, page.url());

    const title = await page.title();
    const builder = new AxeBuilder({ page }).withTags(
      TAGS_BY_STANDARD[rawRequest.standard]
    );
    const axeResult = await builder.analyze();

    const pageShotBuffer = await page.screenshot({
      fullPage: true,
      type: "jpeg",
      quality: 55,
      animations: "disabled",
    });

    // Скриншоты проблемных элементов (ограничены, чтобы не раздувать ответ).
    const violations: Violation[] = [];
    let elementShots = 0;
    const impactRank: Record<string, number> = {
      critical: 0,
      serious: 1,
      moderate: 2,
      minor: 3,
    };
    const sorted = [...(axeResult.violations ?? [])]
      .sort(
        (a, b) =>
          (impactRank[a.impact ?? "minor"] ?? 3) -
          (impactRank[b.impact ?? "minor"] ?? 3)
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
    const penalty = violations.reduce((sum, violation) => {
      const nodeCount = Math.min(Math.max(violation.nodes.length, 1), 6);
      return sum + IMPACT_WEIGHTS[violation.impact] * nodeCount;
    }, 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));

    const host = rawRequest.html ? "локальный файл" : new URL(target).hostname;
    const security = await securityPromise;

    const pageShot = {
      src: `data:image/jpeg;base64,${pageShotBuffer.toString("base64")}`,
      width: VIEWPORTS[rawRequest.device].width,
      height: VIEWPORTS[rawRequest.device].height,
      alt: `Скриншот страницы ${host}`,
      caption: "Страница целиком",
    };

    return {
      url: target,
      host,
      scannedAt: new Date().toISOString(),
      standard: rawRequest.standard,
      device: rawRequest.device,
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

export async function POST(request: Request) {
  let body: ScanRequest;
  try {
    body = (await request.json()) as ScanRequest;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body.url && !body.html) {
    return NextResponse.json(
      { error: "Передайте url или html" },
      { status: 400 }
    );
  }

  const standard: Standard = ["AA", "AAA", "508"].includes(body.standard)
    ? body.standard
    : "AA";
  const device: Device = body.device === "mobile" ? "mobile" : "desktop";

  try {
    const result = await scan({ ...body, standard, device });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось отсканировать страницу";
    const friendly = /ERR_NAME_NOT_RESOLVED|net::|Timeout|NS_ERROR/i.test(
      message
    )
      ? "Сайт не открылся: проверьте адрес или доступность страницы"
      : message;
    return NextResponse.json({ error: friendly }, { status: 422 });
  }
}

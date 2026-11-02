import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import AxeBuilder from "@axe-core/playwright";

/**
 * Механика проверки: axe-core (color-contrast) гоняется на статичном
 * HTML-снапшоте, который на каждом прогоне собирается из НАСТОЯЩИХ токенов
 * `src/app/globals.css` (блоки `:root`, `[data-theme="dark"]` и
 * `@media (prefers-color-scheme: dark) [data-theme="system"]`).
 * В снапшот входят пары «текст/фон», которые реально используются
 * интерфейсом: основной и приглушённый текст, карточка, кнопки
 * primary/accent, акцентные ссылки и чипы, бейдж на foreground/10,
 * destructive. Сеть и dev-сервер не нужны — рендерит локальный chromium.
 * Проверяются три состояния: data-theme="light", "dark" и "system"
 * при prefers-color-scheme: dark (эмуляция в контексте Playwright).
 */

const CSS_PATH = join(__dirname, "..", "..", "src", "app", "globals.css");

/** Вытаскивает декларации custom properties из блока селектора. */
function extractBlock(css: string, selector: string): Record<string, string> {
  const at = css.indexOf(selector);
  if (at === -1) {
    throw new Error(`globals.css: не найден селектор ${selector}`);
  }
  const open = css.indexOf("{", at);
  let depth = 0;
  let end = -1;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open + 1, end);
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
}

/** Блок `[data-theme="system"]` внутри media-запроса тёмной системной темы. */
function extractSystemBlock(css: string): Record<string, string> {
  const media = "@media (prefers-color-scheme: dark)";
  const at = css.indexOf(media);
  if (at === -1) {
    throw new Error(
      "globals.css: не найден media-блок prefers-color-scheme: dark"
    );
  }
  return extractBlock(css.slice(at), '[data-theme="system"]');
}

const readCss = () => readFileSync(CSS_PATH, "utf8");

const varsToCss = (vars: Record<string, string>) =>
  `:root{${Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(";")}}`;

/** Снапшот ключевых текстовых пар интерфейса на переданных токенах. */
function snapshotHtml(vars: Record<string, string>, theme: string): string {
  return `<!doctype html>
<html lang="ru" data-theme="${theme}">
<head><meta charset="utf-8"><title>Снапшот токенов</title><style>
${varsToCss(vars)}
*{box-sizing:border-box;margin:0}
body{background:var(--background);color:var(--foreground);font:400 16px/1.6 sans-serif;padding:24px;max-width:720px}
h1{font-size:24px;font-weight:600}
.muted{color:var(--muted-foreground)}
.card{background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:12px;padding:20px;margin-top:16px}
.card .meta{color:var(--muted-foreground);font-size:13px}
.btn{display:inline-block;background:var(--primary);color:var(--primary-foreground);border-radius:10px;padding:10px 18px;font-size:14px;font-weight:500;margin-right:8px}
.btn-accent{display:inline-block;background:var(--accent);color:var(--accent-foreground);border-radius:10px;padding:10px 18px;font-size:14px;font-weight:500}
.chip{display:inline-block;background:var(--secondary);color:var(--secondary-foreground);border:1px solid var(--border);border-radius:999px;padding:3px 10px;font-size:12px;margin-right:8px}
.chip-selected{display:inline-block;background:color-mix(in oklab,var(--accent) 12%,var(--background));color:var(--accent);border-radius:999px;padding:3px 10px;font-size:12px;font-weight:500}
.badge{display:inline-block;background:color-mix(in oklab,var(--foreground) 10%,var(--card));color:var(--foreground);border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600}
.accent-text{color:var(--accent);font-weight:500}
a.link{color:var(--accent);text-decoration:underline}
.danger{color:var(--destructive)}
.tab-active{display:inline-block;background:var(--accent);color:var(--accent-foreground);border-radius:8px;padding:8px 14px;font-size:13px;font-weight:500}
</style></head>
<body>
  <h1>Проверьте сайт на доступность</h1>
  <p class="muted">Введите URL — получите отчёт по контрастам, alt-текстам и клавиатурной навигации.</p>
  <div class="card">
    <p>Отчёт: example.com</p>
    <p class="meta">Правил пройдено: 62 · Время: 4.1 с</p>
    <p><span class="badge">82/100</span> <span class="chip">WCAG AA</span> <span class="chip-selected">Десктоп</span></p>
  </div>
  <p style="margin-top:16px">
    <span class="btn">Проверить</span>
    <span class="btn-accent">Открыть сканер</span>
    <span class="tab-active">Нарушения</span>
  </p>
  <p style="margin-top:16px">
    <span class="accent-text">План исправления: +12 к скору</span> ·
    <a class="link" href="#">гайд по WCAG</a> ·
    <span class="danger">Критично: 1</span>
  </p>
</body></html>`;
}

type ThemeCase = {
  name: string;
  theme: string;
  vars: Record<string, string>;
  colorScheme: "light" | "dark";
};

/** Кейсы собираются внутри тестов, чтобы падение парсинга было красным кейса. */
function caseLight(): ThemeCase {
  const css = readCss();
  return {
    name: "light",
    theme: "light",
    vars: extractBlock(css, ":root"),
    colorScheme: "light",
  };
}

function caseDark(): ThemeCase {
  const css = readCss();
  return {
    name: "dark",
    theme: "dark",
    vars: extractBlock(css, '[data-theme="dark"]'),
    colorScheme: "light",
  };
}

function caseSystemDark(): ThemeCase {
  const css = readCss();
  return {
    name: "system → dark",
    theme: "system",
    vars: extractSystemBlock(css),
    colorScheme: "dark",
  };
}

let browser: Browser | null = null;
let launchError: string | null = null;

/** Похоже ли исключение на «браузеры Playwright не установлены». */
function isMissingBrowserError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /executable doesn'?t exist|npx playwright install|playwright (cli|install)/i.test(
    text
  );
}

beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch (error) {
    // Среда без скачанных браузеров — axe-тесты ниже помечаются skip,
    // чтобы npm test оставался зелёным; прочие ошибки запуска — честный крах.
    if (isMissingBrowserError(error)) {
      launchError =
        error instanceof Error ? error.message.split("\n")[0] : String(error);
      browser = null;
    } else {
      throw error;
    }
  }
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

function skipHint(): string {
  return `Playwright-браузер не установлен — npm i / npx playwright install chromium${
    launchError ? ` (${launchError})` : ""
  }`;
}

describe("контраст собственных экранов в обеих темах (R06)", () => {
  it("globals.css объявляет токены обеих тем, включая акцент", () => {
    const css = readCss();
    const light = extractBlock(css, ":root");
    const dark = extractBlock(css, '[data-theme="dark"]');
    for (const token of [
      "--background",
      "--foreground",
      "--accent",
      "--accent-foreground",
      "--primary",
      "--primary-foreground",
      "--muted-foreground",
      "--card",
    ]) {
      expect(light, `light: нет токена ${token}`).toHaveProperty(token);
      expect(dark, `dark: нет токена ${token}`).toHaveProperty(token);
    }
  });

  it("axe color-contrast не находит нарушений: тема light", async (ctx) => {
    if (!browser) {
      console.warn(skipHint());
      ctx.skip();
      return;
    }
    await runAxe(browser, caseLight());
  }, 60_000);

  it("axe color-contrast не находит нарушений: тема dark", async (ctx) => {
    if (!browser) {
      console.warn(skipHint());
      ctx.skip();
      return;
    }
    await runAxe(browser, caseDark());
  }, 60_000);

  it("axe color-contrast не находит нарушений: тема system при тёмной системной", async (ctx) => {
    if (!browser) {
      console.warn(skipHint());
      ctx.skip();
      return;
    }
    await runAxe(browser, caseSystemDark());
  }, 60_000);

  async function runAxe(
    runningBrowser: Browser,
    testCase: ThemeCase
  ): Promise<void> {
    const context = await runningBrowser.newContext({
      colorScheme: testCase.colorScheme,
    });
    try {
      const page = await context.newPage();
      await page.setContent(snapshotHtml(testCase.vars, testCase.theme));
      const results = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();
      const summary = results.violations
        .flatMap((violation) =>
          violation.nodes.map(
            (node) =>
              `${violation.id}: ${node.target.join(" ")} — ${
                node.failureSummary?.split("\n")[0] ?? ""
              }`
          )
        )
        .join("\n");
      expect(
        results.violations,
        `нарушения контраста в теме ${testCase.name}:\n${summary}`
      ).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

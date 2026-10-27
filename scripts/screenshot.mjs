/**
 * Снимает скриншоты страниц A11yLens для README и презентации.
 * Запуск: node scripts/screenshot.mjs  (dev-сервер должен работать на :3000)
 * Результат: docs/screenshots/*.png (1600×1000 @2x)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "docs/screenshots";
const ACCOUNT = {
  displayName: "Ivan",
  email: "ivan@gmail.com",
  avatar: { displayName: "Ivan", variant: 3 },
  siteName: "example.com",
  createdAt: new Date().toISOString(),
};

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});

const page = await context.newPage();

// Лендинг (без аккаунта — как видит новый посетитель).
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/landing.png` });

// Сканер: seeding аккаунта и плана, гашение онбординга.
await page.evaluate((account) => {
  localStorage.setItem("a11ylens:account:v1", JSON.stringify(account));
  localStorage.setItem("a11ylens:plan:v1", JSON.stringify("pro"));
  localStorage.setItem("a11ylens:tour-done:v1", "1");
}, ACCOUNT);
await page.goto(`${BASE}/scan`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/scanner-start.png` });

// Запуск скана example.com и ожидание отчёта.
await page.fill("#scan-url", "example.com");
await page.getByRole("button", { name: "Проверить", exact: true }).click();
await page.waitForSelector('h2:has-text("Отчёт:")', { timeout: 90_000 });
await page.waitForTimeout(1500);
// Скролл к началу отчёта: bento + diff.
await page.locator('h2:has-text("Отчёт:")').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/report-overview.png` });

// Вкладка «Безопасность».
await page.getByRole("tab", { name: /Безопасность/ }).click();
await page.waitForTimeout(600);
await page.getByRole("tab", { name: /Безопасность/ }).scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/report-security.png` });

// Тарифы.
await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/pricing.png` });

// Гайд.
await page.goto(`${BASE}/guide`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/guide.png` });

// Регистрация: чистый контекст без аккаунта.
const fresh = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const freshPage = await fresh.newPage();
await freshPage.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await freshPage.waitForTimeout(800);
await freshPage.screenshot({ path: `${OUT}/register.png` });
await fresh.close();

await browser.close();
console.log("OK: screenshots saved to", OUT);

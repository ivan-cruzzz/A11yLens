# notes.md — опорная карта кода A11yLens (разведка прогона 2026-11-02)

Репозиторий: `C:\Users\Sы\Desktop\kwork\check`. Next.js 16.4.3 App Router, React 19.3, Tailwind 4, TypeScript strict, Playwright 1.64 + @axe-core/playwright 4.14. Никакой БД — всё состояние в localStorage браузера.

---

## 1. Карта кода

### API

**`src/app/api/scan/route.ts`** (381 строка) — единственный API-роут, весь конвейер сканирования.
- `export async function POST(request: Request): Promise<NextResponse>` — принимает JSON `ScanRequest { url?, html?, standard, device }`; возвращает `ScanResult` (200) либо `{ error }` со статусом 400 (нет JSON / нет ни url, ни html) или 422 (ошибка скана; сообщения вида `ERR_NAME_NOT_RESOLVED|net::|Timeout|NS_ERROR` заменяются на «Сайт не открылся...»).
- Неэкспортируемые внутренности: `normalizeUrl(raw: string): string` (добавляет `https://`, валидирует протокол, блокирует localhost/приватные диапазоны regex'ом, строки 71–77), `captureElement(page: Page, selector: string): Promise<string | undefined>` (скриншот элемента → base64 data URI; boundingBox timeout 1500 мс, screenshot timeout 2500 мс, отсев < 2×2 px), `securityAudit(page, response, pageUrl)` (сбор данных + вызов всех проверок из `@/lib/security`), `rawPageIsFile(pageUrl)`, `scan(rawRequest: ScanRequest): Promise<ScanResult>` (ядро конвейера).
- Константы-лимиты: `TAGS_BY_STANDARD: Record<Standard, string[]>` (строки 28–48, наборы axe-тегов для AA/AAA/508), `VIEWPORTS: Record<Device, {width,height}>` (desktop 1280×800, mobile 390×844), `MAX_VIOLATIONS = 14`, `MAX_NODES_PER_VIOLATION = 4`, `MAX_ELEMENT_SHOTS = 16`.
- `checksRun` для security-аудита захардкожен выражением `7 + 3 + 1 + 1 + 1 + 1 + 5` (= 19) в строке 174.

**`src/app/badge/route.ts`** — `export function GET(request: NextRequest)`: SVG-бейдж `/badge?score=76&label=example.com`, mono-палитра (#0a0a0a/#fafafa/#a1a1aa), label обрезается до 24 символов, Cache-Control 1 час.

### lib — типы и домен

**`src/lib/types.ts`** (140 строк) — главные типы и константы весов.
- Типы: `Impact = "critical"|"serious"|"moderate"|"minor"`, `Category = "contrast"|"alt"|"keyboard"|"forms"|"aria"|"other"`, `Standard = "AA"|"AAA"|"508"`, `Device = "desktop"|"mobile"`, `SecuritySeverity = "high"|"medium"|"low"|"info"`.
- `ViolationNode { selector, snippet, screenshot?, width?, height? }` — width/height объявлены, но роут их никогда не заполняет.
- `Violation { id, title, help, helpUrl, impact, category, tags, nodes }`.
- `PageScreenshot { src, width, height, alt, caption }`; `SecurityFinding { id, title, severity, detail, recommendation }`; `SecurityAudit { score, findings, checksRun }`; `ScanRequest { url?, html?, standard, device }`; `ScanMeta { title, loadMs, rulesRun, passedRules, incompleteRules }`; `ScanResult { url, host, scannedAt, standard, device, score, counts, totalViolations, totalNodes, meta, violations, pageScreenshot?, security? }`.
- Лейблы: `SECURITY_SEVERITY_LABELS`, `CATEGORY_LABELS`, `IMPACT_LABELS` (русские подписи).
- **Веса скоринга**: `IMPACT_WEIGHTS = { critical: 12, serious: 8, moderate: 4, minor: 2 }` (строки 118–123); `IMPACT_ORDER`, `CATEGORY_ORDER`.

**`src/lib/security.ts`** (431 строка) — все пассивные проверки кибербезопасности (см. раздел 4). Экспорты: `auditHeaders(headers: Record<string,string>): SecurityFinding[]`, `auditCookies(cookies: CookieInfo[]): SecurityFinding[]` (+ `export interface CookieInfo { name, secure, httpOnly, sameSite }`), `auditMixedContent(pageIsHttps: boolean, insecureResourceUrls: string[]): SecurityFinding[]`, `auditSri(externals: {src, hasIntegrity}[]): SecurityFinding[]`, `auditVersionDisclosure(input: { poweredBy?, generator?, jqueryVersion? }): SecurityFinding[]`, `auditHttpsRedirect(hostname: string): Promise<SecurityFinding[]>`, `probeSensitiveFiles(origin: string): Promise<SecurityFinding[]>`, `computeSecurityScore(findings): number`, `buildSecurityAudit(findings, checksRun): SecurityAudit`. Неэкспортируемые: `lowerHeaders`, `finding(...)`, `SENSITIVE_PATHS` (5 путей), `SEVERITY_WEIGHT = { high: 20, medium: 10, low: 5, info: 0 }`.

**`src/lib/knowledge.ts`** (415 строк) — база «AI-советов» и движки разбора.
- `RULE_TIPS: Record<string, Tip>` — ~40 правил axe-core → `Tip { wcag, short, full, code? }`; `FALLBACK: Tip`; `tipFor(ruleId): Tip`.
- **Движки разбора**: `type EngineId = "express" | "deep" | "strict"`; `ENGINE_OPTIONS` — массив из трёх движков (экспресс/глубокий/строгий), каждый с `efforts` (low/medium/high/max) и `defaultEffort`.
- `buildAdvice(ruleId, engine: EngineId, detail: "short"|"full"): Advice` — собирает совет: express+short → одна строка; strict добавляет чек-лист и код; deep при full добавляет пример кода.
- `categoryOf(ruleId: string): Category` — маппинг id правила axe на 6 категорий (if-цепочка, строки 352–414).

**`src/lib/scan-diff.ts`** (39 строк) — `interface ScanDiff { previousScore, currentScore, deltaScore, fixed[], appeared[], countsDelta }`; `computeDiff(current: ScanResult, previous: ScanResult): ScanDiff` — сравнение по множествам violation id.

**`src/lib/report-store.ts`** (81 строка) — история «полных» отчётов в localStorage, ключ `a11ylens:reports:v1`, `MAX_REPORTS = 50`. `type SlimReport = ScanResult` (алиас). Экспорты: `getAllReports()`, `saveReportFull(result): SlimReport[]` (через `stripHeavy` — выкидывает pageScreenshot и node.screenshot), `getReportsByHost(host)`, `getPreviousReport(host, currentScannedAt)`, `getLatestByHost(host)`.

**`src/lib/subscription.ts`** (121 строка) — тарифы. `type PlanId = "free"|"pro"|"business"`; `interface Plan { id, name, priceRub, scansPerDay: number|null, bulk, pdf }`; `PLANS`: free (0 ₽, 5 сканов/день, без bulk/pdf), pro (990 ₽, 100, bulk+pdf), business (2990 ₽, безлимит, bulk+pdf). Ключи: `a11ylens:plan:v1`, `a11ylens:usage:v1`. Экспорты: `getPlan()`, `setPlan(id)`, `getUsageToday(): Usage` (`{ date: "YYYY-MM-DD", count }`), `recordScan()`, `canScan(): boolean`. Лимиты чисто клиентские.

**`src/lib/i18n.tsx`** (240 строк) — RU/EN. `DICT` — два словаря `ru`/`en` (~60 ключей вида `"nav.features"`, `"hero.title"`, `"scan.check"`); `type DictKey = keyof typeof DICT["ru"]`. Экспорты: `useLocale()` (контекст `{ locale, setLocale }`), `useT()` (хук `t(key)` с fallback на ru), `I18nProvider`, `LocaleToggle` (переключатель RU/EN). Ключ localStorage: `a11ylens:locale:v1`.

**`src/lib/guide.ts`** (62 строки) — контент гайда: `interface GuideRule { id, title, wcag, hint }`, `GuideSection { principle, description, rules }`, `GUIDE_SECTIONS` — 4 принципа WCAG, 18 правил (id вида `g-alt`, `g-contrast`...).

**`src/lib/history.ts`** (80 строк) — пользовательская история с «лицами». `interface HistoryEntry { id, url, host, score, scannedAt, standard, device, totalViolations, counts, avatar: {displayName, variant}, face? }`. Ключ `a11ylens-history` (**без** `:v1` — стиль отличается от остальных), `MAX_ENTRIES = 20`. Экспорты: `loadHistory()`, `saveHistory(entry)`, `removeHistory(id)`, `clearHistory()`. Лицо (face) вычисляется на клиенте из seed, в хранилище идёт только seed.

**`src/lib/watchlist.ts`** (82 строки) — мониторинг хостов. `interface WatchEntry { host, lastScore, prevScore: number|null, scannedAt }`. Ключ `a11ylens:watchlist:v1`. Экспорты: `loadWatchlist()`, `isWatched(host)`, `addToWatchlist(host, score)`, `removeFromWatchlist(host)`, `updateWatchEntry(host, score): { entries, prevScore }` (для бейджа ↑/↓).

**`src/lib/export-file.ts`** (120 строк) — экспорт отчёта. `downloadFile(content, filename, mime)`, `reportToJson(result): string`, `reportToCsv(result): string` (строки типа `a11y`/`security`, CSV-экранирование), `downloadReportJson(result)`, `downloadReportCsv(result)` (имена вида `a11ylens-<host>-<YYYY-MM-DD>.json|csv`).

**`src/lib/pdf.ts`** (165 строк) — `exportReportPdf(result: ScanResult, engine: EngineId): Promise<void>`: собирает HTML в скрытом div (794px), рендерит `html2canvas-pro` (дин. импорт, oklch-совместим), режет canvas на страницы A4 через jsPDF, JPEG quality 0.92, файл `a11ylens-<host>-<дата>.pdf`. Внутренние: `esc(text)`, `buildHtml(result, engine)` (весь layout PDF инлайн-стилями, цвета #0a0a0a/#334155/#64748b — отдельная палитра вне токенов), `IMPACT_RU` — дубль `IMPACT_LABELS`.

**`src/lib/account.ts`** (67 строк) — фейковый аккаунт. `interface Account { displayName, email, avatar: {displayName, variant}, siteName, createdAt }`. Ключ `a11ylens:account:v1`. Экспорты: `loadAccount()`, `saveAccount()`, `clearAccount()`, `normalizeNextPath(next)` (только внутренние пути, иначе `/scan`), `registerPathIfNeeded(next)` (гейт: нет аккаунта → `/register?next=...`).

**`src/lib/utils.ts`** — 1 строка: `export { cn } from "cn"`.

### Страницы

**`src/app/page.tsx`** (162 строки, client) — лендинг: шапка (`LandingNav`), герой с `HalftoneBackground` + `HeroForm`, секция возможностей (`FeatureBento` + `LiveDemo`), «как это работает» (3 шага + `CurrencyTransfer`-визуализация), футер. Всё через `useT()`.

**`src/app/scan/page.tsx`** (1278 строк, client) — ядро приложения, компонент `ScanPage` (обёрнут в `Suspense` из-за `useSearchParams`; автозапуск скана при `?url=`). Состояния: url/standard/device/engine (model+effort), scanning/phase/error/result, bulk, history, theme, account, plan, diff, watch-состояния. Ключевые колбэки: `runScan(overrideUrl?)` (POST `/api/scan`, `recordScan()`, `saveReportFull`, diff, watchlist, toast), `scanBulk(target)` (то же для массовой проверки), `exportPdf` (гейт `plan.pdf`), `saveReport(avatar)`. Секции UI: панель запуска (стандарт/устройство/движок/watch-чекбокс), прогресс (`ScanStepper` + `ScanSkeleton`), отчёт (`ScanDiffCard`, `WidgetGrid` bento, вкладки `SmoothTab` с категориями + `security`, `LightboxGrid` скриншотов), сохранение/экспорт (PDF/JSON/CSV/бейдж+markdown), массовая проверка (`BulkUpload`), история (`AccountStats` + список с `ScoreSparkline`/`HoldButton`). Оверлеи: `LimitModal`, `CommandPalette`, `OnboardingTour`, `AiChat`. `SCAN_PHASES` — 4 строки прогресса, тикают каждые 2600 мс.

**`src/app/register/page.tsx`** (257 строк, client) — двухшаговая регистрация: шаг 1 имя/email/пароль (валидация: email regex `/.+@.+\..+/`, пароль ≥ 8), шаг 2 выбор «лица» (`avatar-picker`, кнопка «Другое лицо» = variant+1) + название сайта (автозаполняется хостом из `?next=/scan?url=…`). `saveAccount()` → `router.replace(next)`. Если аккаунт уже есть — редирект сразу (прямое обращение к localStorage-ключу строкой, строка 35).

**`src/app/pricing/page.tsx`** (93 строки, client) — тарифы: `PlanCards` + `CheckoutModal` (демо-оплата: карта 16 цифр/ММГГ/CVC никуда не отправляется, `setPlan` через 1200 мс).

**`src/app/guide/page.tsx`** (175 строк, client) — чеклист по `GUIDE_SECTIONS`, прогресс в localStorage `a11ylens:guide-progress:v1` (массив отмеченных id), прогресс-бар scaleX + проценты.

**`src/app/layout.tsx`** — корневой layout: шрифты IBM_Plex_Sans (`--font-plex`, latin+cyrillic) и JetBrains_Mono (`--font-jetbrains`), `<html lang="ru" class="dark …">` (тёмная тема по умолчанию всегда), провайдеры `I18nProvider` → `ToastProvider`. Metadata с русским описанием.

**`src/app/scan/layout.tsx`** — только metadata, `children` без обёрток.

### components/app (крупные)

| Файл | Компонент и пропсы |
|---|---|
| `account-stats.tsx` | `AccountStats` (без пропсов) — сворачиваемая секция «Моя статистика»: `computeStats()` из `getAllReports()` — totalScans, uniqueHosts, averageScore, best/worst, активность за 14 дней |
| `ai-chat.tsx` | `AiChat({ result: ScanResult \| null })` — плавающий «ИИ-помощник», rule-based `answerFor(question, result)` без API; QUICK_PROMPTS, ответ с задержкой 450 мс |
| `bulk-upload.tsx` | `BulkUpload({ onScan: (target: BulkTarget) => Promise<void>, maxFiles = 3 })`, `BulkTarget { url?, html?, label }`; `extractUrl(line)` парсит CSV/TXT, до 10 URL, файлы ≤ 2 МБ |
| `checkout-modal.tsx` | `CheckoutModal({ plan, open, onClose, onSuccess })` — демо-форма карты, валидация 16/4/3 цифр |
| `command-palette.tsx` | `CommandPalette({ actions: PaletteAction[] })`, `PaletteAction { id, label, hint?, icon: "scan"\|"wallet"\|"pdf"\|"history"\|"guide"\|"theme", run }` — ⌘K/Ctrl+K, фильтр, стрелки, Enter |
| `feature-bento.tsx` | `FeatureBento` — bento-карточки возможностей лендинга (ScoreDemo, ContrastSwatches, Keycaps) |
| `hero-form.tsx` | `HeroForm` — input + `ParticleButton`; `registerPathIfNeeded("/scan?url=…")` |
| `landing-nav.tsx` | `LandingNav` — якоря #features/#how, `LocaleToggle`, аватар аккаунта, CTA «Открыть сканер» |
| `limit-modal.tsx` | `LimitModal({ open, used, limit, onClose })` — «Лимит исчерпан», апселл тарифов |
| `live-demo.tsx` | `LiveDemo` — анимированное демо отчёта (DEMO_SCORES 58→81, тик 50 мс) |
| `onboarding-tour.tsx` | `OnboardingTour` — 3 подсказки по селекторам (`#scan-url`, `#history`, …), ключ `a11ylens:tour-done:v1` |
| `plan-cards.tsx` | `PlanCards({ currentPlanId, onCheckout })` — 3 тарифа, Pro выделен рамкой |
| `scan-diff.tsx` | `ScanDiffCard({ diff: ScanDiff \| null })` — анимированная дельта, списки fixed/appeared (до 4) |
| `scan-skeleton.tsx` | `ScanSkeleton` — пульсирующий скелет bento |
| `scan-stepper.tsx` | `ScanStepper({ phases: string[], current: number })` — прогресс-линия + 4 шага |
| `score-counter.tsx` | `ScoreCounter({ value, size?: "sm"\|"lg", className? })` — анимированный счётчик 0–100, вердикты ≥80/≥50/ниже |
| `score-sparkline.tsx` | `ScoreSparkline({ scores: number[], className? })` — чистый SVG polyline 96×32 |
| `security-row.tsx` | `SecurityRow({ finding: SecurityFinding })` — карточка находки с критичностью и рецептом |
| `toast.tsx` | `ToastProvider`/`useToast()` — тосты 3500 мс, портал в body, aria-live |
| `violation-modal.tsx` | `ViolationModal({ title, description?, impactLabel?, items?: OrderItem[], advice?: {short, full}\|null, confirmLabel?, children })` — модалка деталей, кнопки «Кратко/Подробно» |
| `violation-row.tsx` | `ViolationRow({ violation, index, engine })` — строка нарушения, обёрнута в ViolationModal |

`src/components/kokonutui/*` — кастомная UI-библиотека (avatar-picker с `createFace(seed)`, `avatarSeed(name, variant)`, `FaceArt`; bento-grid с `WidgetGrid`/`WidgetGridItem`; particle-button, hold-button, slide-to-confirm, smooth-tab, smooth-drawer, lightbox-grid, loader, profile-dropdown, scroll-index, ai-model-selector, file-upload, halftone-background, currency-transfer). `src/components/ui/button.tsx`, `drawer.tsx` — shadcn/vaul.

**`scripts/screenshot.mjs`** (83 строки) — генерация скриншотов для README: Playwright chromium, viewport 1600×1000 @2x, требует работающий dev-сервер на `http://localhost:3000`; сидирует localStorage (`a11ylens:account:v1`, `a11ylens:plan:v1`="pro", `a11ylens:tour-done:v1`), сканирует example.com (таймаут ожидания отчёта 90 с), снимает landing/scanner-start/report-overview/report-security/pricing/guide/register в `docs/screenshots/`.

---

## 2. Конвенции

**Именование файлов**: kebab-case везде — страницы (`src/app/<маршрут>/page.tsx`), компоненты (`src/components/app/score-counter.tsx`), lib-модули (`src/lib/export-file.ts`). Компоненты — default export с PascalCase именем; вспомогательные типы/хуки — именованные экспорты в том же файле. Импорт через алиас `@/*` → `./src/*`.

**Стилизация**: Tailwind 4 утилити + семантические токены. `src/app/globals.css`:
- `@theme inline` мапит токены в Tailwind-цвета: `--color-background`, `--color-foreground`, `--color-card(+ -foreground)`, `--color-popover(+…)`, `--color-primary(+…)`, `--color-secondary(+…)`, `--color-muted(+…)`, `--color-accent(+…)`, `--color-destructive`, `--color-border`, `--color-input`, `--color-ring`, `--color-chart-1..5`, вся группа `--color-sidebar-*`, шрифты `--font-sans` (→ `--font-plex`, IBM Plex Sans), `--font-mono` (→ `--font-jetbrains`), `--font-heading`; радиусы `--radius-sm…4xl` от базового `--radius: 0.625rem`.
- `:root` (light): все окрестные значения — **oklch с нулевой хромой** (`oklch(1 0 0)` фон, `oklch(0.145 0 0)` текст, `oklch(0.205 0 0)` primary...), т.е. чистый монохром; единственный цветной токен — `--destructive: oklch(0.577 0.245 27.325)`.
- `.dark`: hex-монохром zinc-палитра — `--background: #0a0a0a`, `--foreground: #fafafa`, `--card: #141414`, `--secondary/--muted/--accent: #1c1c1c`, `--muted-foreground: #a1a1aa`, `--border/--input: #262626`, `--ring: #71717a`, `--chart-1..5: #d4d4d8 → #3f3f46`, `--destructive: #ef4444`. Dark-вариант через `@custom-variant dark (&:is(.dark *))`; класс `dark` прибит к `<html>` в layout.tsx (светлая тема практически не используется).
- PDF (`src/lib/pdf.ts`) и бейдж (`src/app/badge/route.ts`) используют собственные захардкоженные цвета (#0a0a0a/#fafafa/#334155/#64748b/#a1a1aa), не токены.

**i18n**: словари `DICT.ru` / `DICT.en` в `src/lib/i18n.tsx`, плоские ключи `"секция.имя"` (`nav.*`, `hero.*`, `scan.*`, `pricing.*`, `register.*`, `guide.*`, `common.*`, `features.*`, `how.*`, `step1..3.*`, `footer.*`). Новая строка: добавить ключ в ОБА словаря (тип `DictKey` выводится из `ru`), использовать `const t = useT()` → `t("ключ")`; fallback на ru. Локаль хранится в `a11ylens:locale:v1`. Важно: переведена в основном лендинг-обвязка; бо́льшая часть строк `/scan`, `/pricing`, `/register` — русские хардкод-литералы в JSX, не в DICT.

**Состояние (localStorage, точные ключи)**:
| Ключ | Модуль | Что хранит | Лимит |
|---|---|---|---|
| `a11ylens:reports:v1` | report-store.ts | массив SlimReport (без скриншотов) | 50 |
| `a11ylens:plan:v1` | subscription.ts | `"free"\|"pro"\|"business"` (JSON) | — |
| `a11ylens:usage:v1` | subscription.ts | `{ date: "YYYY-MM-DD", count }` | сброс при смене дня |
| `a11ylens:locale:v1` | i18n.tsx | `"ru"\|"en"` | — |
| `a11ylens:account:v1` | account.ts | Account (JSON) | — |
| `a11ylens:watchlist:v1` | watchlist.ts | WatchEntry[] | — |
| `a11ylens-history` | history.ts | HistoryEntry[] (без face) | 20 |
| `a11ylens:guide-progress:v1` | guide/page.tsx | string[] отмеченных правил | — |
| `a11ylens:tour-done:v1` | onboarding-tour.tsx | `"1"` | — |

Все lib-модули-guard'ятся `typeof window === "undefined"` и try/catch вокруг localStorage.

**Дизайн-система**: монохром (чёрный/белый/градации zinc), без акцентного цвета; иерархия через яркость foreground (`text-foreground/80`, `bg-foreground/10`), не через hue. Карточки `rounded-2xl border border-border bg-card/50`. Анимации — motion/react, общий ease `[0.23, 1, 0.32, 1]`, везде уважение `useReducedMotion`. Иконки lucide-react с `aria-hidden`. Скринридер-гигиена: sr-only label'ы, `role="status"/"alert"`, aria-pressed у переключателей.

---

## 3. Конвейер сканирования

POST `/api/scan` → готовый отчёт, по шагам (`src/app/api/scan/route.ts`):

1. **Валидация** (POST, строки 346–364): парсинг JSON (400 при ошибке), требование `url` или `html` (400), whitelisting `standard` ∈ {AA, AAA, 508} (иначе `"AA"`), `device` (иначе `"desktop"`).
2. **normalizeUrl** (строки 59–79): trim → добавление `https://` при отсутствии схемы → `new URL()` → только http/https → блокировка внутренних адресов regex'ом `(localhost|127.|0.0.0.0|[::1]|10.|192.168.|172.16-31.)`.
3. **Playwright** (строки 194–202): `chromium.launch({ headless: true })` — новый браузер на каждый скан, закрывается в `finally` (строки 341–343). Контекст: вьюпорт из `VIEWPORTS` (desktop 1280×800 / mobile 390×844), `deviceScaleFactor: 1`, `isMobile` для mobile, `locale: "ru-RU"`; `page.setDefaultTimeout(30_000)`.
4. **Загрузка страницы**: `html` → `page.setContent(html, { waitUntil: "load" })` (security-аудит отключён); url → `page.goto(target, { waitUntil: "load", timeout: 30_000 })`, сохраняется `mainResponse`. Затем `page.waitForTimeout(1200)` на отрисовку.
5. **Security-аудит стартует параллельно** (строки 218–220): `securityAudit(page, mainResponse, page.url())` в promise — снимок заголовков ответа, куки контекста, `page.evaluate` (insecure-ресурсы из performance API ≤ 10, внешние скрипты без SRI ≤ 15, meta generator, `window jQuery.fn.jquery`), затем все проверки security.ts, включая сетевые: `auditHttpsRedirect` (fetch `http://<host>/`, redirect: manual, AbortController 5000 мс) и `probeSensitiveFiles` (5 последовательных GET-проб, таймаут 4000 мс каждая). Любая ошибка → `undefined` (отчёт не ломается). `checksRun` = 19 (хардкод, строка 174).
6. **axe-core** (строки 222–226): `new AxeBuilder({ page }).withTags(TAGS_BY_STANDARD[standard])` → `builder.analyze()` — дефолтные правила axe 4.14 по выбранным тегам WCAG 2.x + best-practice (для 508 — тег section508).
7. **Скриншот страницы** (строки 228–233): `page.screenshot({ fullPage: true, type: "jpeg", quality: 55, animations: "disabled" })` → base64 data URI. Нюанс: `width`/`height` в `pageShot` записываются из VIEWPORTS, хотя снимок fullPage (высота фактическая другая).
8. **Нарушения**: сортировка по impact (critical→minor, локальный `impactRank`, строки 238–243) → срез `MAX_VIOLATIONS = 14` → на каждое до `MAX_NODES_PER_VIOLATION = 4` узлов; snippet обрезается до 160 симв.; на первые `MAX_ELEMENT_SHOTS = 16` узлов — элементные скриншоты через `captureElement` (PNG, data URI). `category` присваивается `categoryOf(violation.id)` из knowledge.ts.
9. **Скор доступности** (строки 299–307): `penalty = Σ IMPACT_WEIGHTS[violation.impact] × min(max(nodes.length, 1), 6)`, где `IMPACT_WEIGHTS = { critical: 12, serious: 8, moderate: 4, minor: 2 }`; `score = clamp(100 − penalty, 0, 100)`. (Cap узлов 6 фактически недостижим — nodes уже ≤ 4.) Скор считается по обрезанным данным (14×4).
10. **Скор безопасности** (`security.ts:398–411`): `penalty = Σ SEVERITY_WEIGHT[severity]` (`high: 20, medium: 10, low: 5, info: 0`), `score = clamp(100 − penalty, 0, 100)`; находки сортируются high→info (`buildSecurityAudit`).
11. **Сборка ScanResult** (строки 320–340): url/host/scannedAt/standard/device/score/counts (по категориям)/totalViolations/totalNodes/`meta { title, loadMs, rulesRun = passes + violations, passedRules, incompleteRules }`/violations/pageScreenshot/security. Клиент: `recordScan()` → `saveReportFull()` → diff c `getPreviousReport` → watchlist → UI.

**Движки разбора (не движки сканирования)**: `src/lib/knowledge.ts` — `EngineId = "express" | "deep" | "strict"` в `ENGINE_OPTIONS`; выбор в UI через `AIModelSelector` (kokonutui), состояние `engine { model, effort }` на `/scan`; влияет только на текст советов: `buildAdvice(ruleId, engine, detail)` в `ViolationRow`, PDF (`exportReportPdf(result, engine)`) и AiChat. Сами проверки axe всегда одинаковые.

---

## 4. Существующие проверки безопасности (src/lib/security.ts)

Полный список уникальных id (20, а не 19 — см. слабые места):

| # | id | Функция | Severity | Что проверяет |
|---|---|---|---|---|
| 1 | `sec-csp` | auditHeaders | high | нет Content-Security-Policy |
| 2 | `sec-hsts` | auditHeaders | medium | нет Strict-Transport-Security |
| 3 | `sec-clickjacking` | auditHeaders | medium | нет X-Frame-Options и CSP frame-ancestors |
| 4 | `sec-nosniff` | auditHeaders | low | нет X-Content-Type-Options |
| 5 | `sec-referrer` | auditHeaders | low | нет Referrer-Policy |
| 6 | `sec-permissions` | auditHeaders | info | нет Permissions-Policy |
| 7 | `sec-coop` | auditHeaders | low | нет Cross-Origin-Opener-Policy |
| 8 | `sec-cookie-secure` | auditCookies | medium | куки без Secure (до 5 имён в detail) |
| 9 | `sec-cookie-httponly` | auditCookies | medium | куки без HttpOnly |
| 10 | `sec-cookie-samesite` | auditCookies | low | куки без SameSite / SameSite=None |
| 11 | `sec-mixed-content` | auditMixedContent | high | http://-ресурсы на https-странице (≤ 3 примера) |
| 12 | `sec-sri` | auditSri | medium | внешние `<script src>` без integrity (≤ 2 примера) |
| 13 | `sec-version-disclosure` | auditVersionDisclosure | low | X-Powered-By и/или meta generator |
| 14 | `sec-jquery-version` | auditVersionDisclosure | medium (устар.) / info | версия jQuery; < 3.5 → «устаревший с CVE-2020-11022/11023» |
| 15 | `sec-https-redirect` | auditHttpsRedirect | medium | `http://host/` не отдаёт 301/302/308 на `https://` (fetch с redirect: manual) |
| 16 | `sec-git-exposed` | probeSensitiveFiles | high | `GET /.git/HEAD` = 200 и тело матчит `/ref:/` |
| 17 | `sec-env-exposed` | probeSensitiveFiles | high | `GET /.env` = 200 и матчит `/^
[A-Z_]+=|\bDB_PASSWORD\b/` |
| 18 | `sec-phpinfo` | probeSensitiveFiles | medium | `GET /phpinfo.php` = 200 и матчит `/phpinfo\(\)|PHP Version/i` |
| 19 | `sec-backup-config` | probeSensitiveFiles | high | `GET /wp-config.php.bak` = 200 и матчит `/DB_PASSWORD|DB_HOST|define\(/` |
| 20 | `sec-dsstore` | probeSensitiveFiles | low | `GET /.DS_Store` = 200 и матчит `/\x00Bud1|Bud1/` |

Структура `SecurityFinding` (types.ts:46–54): `{ id: string; title: string; severity: SecuritySeverity; detail: string; recommendation: string }` — detail с конкретикой сайта, recommendation — рецепт. `SecurityAudit { score, findings (отсортированы high→info), checksRun }`.

**Защита проб от SPA-фолбэков на 200** (`probeSensitiveFiles`, строки 361–394): каждый из 5 `SENSITIVE_PATHS` имеет обязательное поле `match: RegExp`; после GET проверяется не только `response.ok`, но и `probe.match.test(body)` на первых 4096 байтах тела. SPA-роутер, отдающий index.html на любой путь, не матчится ни одним из regex'ов (`ref:`, `DB_PASSWORD`, `phpinfo()`, `Bud1`...) → ложного срабатывания нет. Таймаут каждой пробы 4000 мс (AbortController), UA `A11yLens-security-audit`, сетевые ошибки молча пропускаются. Пробы идут последовательно (до ~20 с в худшем случае), но стартуют параллельно с axe-анализом.

---

## 5. Команды

- `npm run dev` — `next dev`; `npm run build` — `next build`; `npm start` — `next start`. **Подтверждено: в package.json (строки 5–9) только эти три скрипта** — нет test, lint, format, typecheck-скриптов; в devDependencies нет eslint/prettier/vitest/jest (в коде, тем не менее, остались `eslint-disable`-комментарии: scan/page.tsx:1075, onboarding-tour.tsx:66).
- `node scripts/screenshot.mjs` — скриншоты для README (нужен запущенный dev-сервер на :3000).
- Браузеры Playwright: `%LOCALAPPDATA%\ms-playwright` (найдены `chromium-1243`, `chromium-1248`, `chromium_headless_shell-1243/1248`, `ffmpeg-1011/1013`, `winldd-1007`). Установка: `npx playwright install chromium`. `next.config.ts` содержит `serverExternalPackages: ["playwright", "playwright-core", "axe-core"]`, `cacheComponents: true`, `partialPrefetching: true`, turbopack-правило для CSS.
- Прочее окружение: tsconfig strict, алиас `@/*`; AGENTS.md описывает процесс Autopilot (коммиты с трейлером `Requirements: RXX`); манифест текущей сборки — `.autopilot/2026-11-02-a11ylens-upgrade--wip/manifest.md` (R01–R09i, G01: CLI-проверка, Tauri-десктоп, TLS/порты/поддомены/CVE/SPF-DKIM-DMARC).

---

## 6. Слабые места для будущего улучшения (только факты из кода)

**Дублирование**
- `src/app/scan/page.tsx`: `runScan` (строки 191–250) и `scanBulk` (строки 260–317) — почти идентичные POST→recordScan→saveReportFull→diff→watchlist-блоки (строки 215–235 и 279–292 совпадают дословно).
- `impactRank` определён дважды: `src/app/api/scan/route.ts:238–243` и `src/components/app/ai-chat.tsx:24–30`, при том что в `types.ts:125–130` уже есть `IMPACT_ORDER` с теми же значениями.
- `IMPACT_RU` в `src/lib/pdf.ts:6–11` дублирует `IMPACT_LABELS` из `types.ts:111–116`.
- localStorage-ключ `"a11ylens:account:v1"` захардкожен строкой в `src/app/register/page.tsx:35` вместо константы из account.ts.
- Русские подписи категорий/критичностей повторяются в словарях types.ts, knowledge.ts и JSX /scan.

**Отсутствие тестов**: 0 тестовых файлов в репозитории; ни одного тест-раннера в зависимостях (package.json). Скоринг (IMPACT_WEIGHTS/SEVERITY_WEIGHT), computeDiff, categoryOf, normalizeUrl, probeSensitiveFiles — всё без тестов.

**Magic numbers**
- route.ts: `MAX_VIOLATIONS=14`, `MAX_NODES_PER_VIOLATION=4`, `MAX_ELEMENT_SHOTS=16` (55–57); `waitForTimeout(1200)` (214); таймауты 30_000/1500/2500; snippet 160 симв. (258); cap узлов 6 в формуле скора (304) — мёртвый при nodes ≤ 4; `checksRun = 7+3+1+1+1+1+5 = 19` (174) — при этом уникальных id проверок 20 (см. ниже).
- security.ts: `SEVERITY_WEIGHT {20,10,5,0}` (398–403); таймауты 5000/4000; срезы 10/15/5/3/2 в сборе данных; `body.slice(0, 4096)` (377); порог jQuery 3.5.0 (250).
- types.ts: `IMPACT_WEIGHTS {12,8,4,2}` (118–123).
- scan/page.tsx: тикер фаз 2600 мс (207); bulk-список `.slice(0, 12)` (299, 309); fallback лимита `?? 5` (1251); truncate title 42 (531).
- pdf.ts: ширина 794px, scale 2, JPEG 0.92; badge: `label.length * 6.6 + 6` (route.ts:22).

**Обработка ошибок в роуте сканирования**
- Только два кода ошибок: 400 и 422; `securityAudit` целиком обёрнут в try/catch с `return undefined` (route.ts:176–179) — любые баги аудита невидимы (silent failure), найти причину невозможно.
- `probeSensitiveFiles` и `auditHttpsRedirect` глотают все сетевые ошибки без логирования (security.ts:298–301, 389–391).
- SSRF-фильтр `normalizeUrl` (route.ts:71–77) не покрывает: `169.254.*` (link-local/cloud metadata), десятичную/восьмеричную запись IP (`http://2130706433` → hostname не матчится), DNS-имена, резолвящиеся в приватные IP (DNS rebinding), `0177.0.0.1`. Серверного rate limiting нет — лимиты только клиентские (subscription.ts, localStorage).
- `html`-режим: нет ограничения размера `rawRequest.html`; security-аудит для html отключён; `host` = строка «HTML-файл» (route.ts:187, 309).
- `pageShot.width/height` из VIEWPORTS при `fullPage: true` скриншоте — высота в отчёте занижена (route.ts:312–318).
- `ViolationNode.width/height` объявлены (types.ts:18–19), но роутом не заполняются; UI использует `node.height ?? 400 / node.width ?? 640` (scan/page.tsx:483–485).

**Таймауты**
- `AxeBuilder.analyze()` вызывается без таймаута (route.ts:226) — на тяжёлых страницах единственный ограничитель это `page.setDefaultTimeout(30_000)` на действия, но не на сам analyze; суммарное время запроса не ограничено (fetch-пробы добавляют до ~20+5 с последовательно).
- Браузер запускается на каждый POST-запрос (`chromium.launch` в `scan()`, route.ts:194) — нет пула/переиспользования; холодный старт ~1 с на каждый скан.
- `probeSensitiveFiles` — последовательный `for`-цикл по 5 путям (security.ts:365).

**Что сломается/мешает при выносе движка в CLI/десктоп (по G01/R04 манифеста)**
- Ядро скана не переиспользуемо: `scan()`, `securityAudit()`, `captureElement()`, `normalizeUrl()` — всё неэкспортировано внутри Next.js route handler (route.ts); `POST` возвращает `NextResponse` — нужен слой, независимый от next/server.
- Скриншоты существуют только как base64 data URI внутри JSON-ответа — CLI/десктопу нужна запись файлов; полный отчёт с JPEG/PNG легко превышает мегабайты.
- Лимиты/тарифы/история/watchlist — целиком в localStorage браузера (subscription.ts, report-store.ts, history.ts, watchlist.ts, account.ts); в CLI их придётся дублировать или выносить в общее хранилище.
- i18n покрывает только лендинг-строки (DICT в i18n.tsx); строки /scan, /register, /pricing, /guide и все тексты security-находок/советов — русские литералы в коде (security.ts, knowledge.ts, guide.ts, scan/page.tsx).
- `categoryOf` из knowledge.ts импортируется серверным роутом, а тот же knowledge.ts используется клиентскими компонентами — смешение домен-логики и UI-текста в одном модуле; при разделении движок утащит за собой русские тексты советов.
- PDF-экспорт завязан на браузерный DOM (`document.createElement`, html2canvas-pro, jspdf в pdf.ts) — в CLI недоступен без headless-браузера; альтернатива — генерация из CLI другим рендером.
- Зависимость от локального chromium в `%LOCALAPPDATA%\ms-playwright` (serverExternalPackages в next.config.ts); для Tauri/десктопа нужен бандл браузера или системный Edge.
- `checksRun = 19` (route.ts:174) не соответствует фактическому числу проверок: 20 уникальных `sec-*` id в security.ts (grep подтверждает 20), README тоже заявляет «19 пассивных проверок» — расхождение источник/документация.

**Прочее**
- `report-store.ts` хранит до 50 отчётов в localStorage (~5 МБ квота, persist молча проглатывает QuotaExceeded, строки 50–52); stripHeavy не чистит `security` и `tags`.
- `history.ts` хранит «лица» через пересчёт `createFace(avatarSeed(...))` при каждой загрузке (строки 33–38) — зависимость истории от UI-модуля kokonutui/avatar-picker.
- На `/scan` при отсутствии аккаунта — принудительный `router.replace` на /register (scan/page.tsx:178–186): прямой заход по ссылке без аккаунта невозможен, CLI-сценарий «просто отсканировать» на сайте тоже.
- `AiChat.answerFor` — if-цепочка по подстрокам вопроса («начать», «контраст», «скринридер»...) — расширение требует правки функции (ai-chat.tsx:36–89).

# interfaces.md — границы прогона

## Границы, решённые в спецификации

### Единицы сборки и их владение

| Единица | Владеет | Экспортирует (шов) | Скрывает |
|---|---|---|---|
| `src/engine/` | конвейер сканирования, реестр security-проверок, нативные проверки (TLS/порты/поддомены/CVE/почта), скоринг, модель отчёта, словарь советов | `runScan(options: ScanOptions): Promise<ScanResult>`; `runSecurityAudit(url, init): Promise<SecurityReport>`; `runNativeAudit(url, mode): Promise<NativeReport>` (только CLI/десктоп); `IMPACT_WEIGHTS`, `SEVERITY_WEIGHTS`, `SECURITY_CHECKS` (реестр), типы `ScanResult`/`Violation`/`SecurityFinding`/`NativeFinding`; `normalizeUrl`, `assertPublicHttpUrl` (SSRF-фильтр) | жизненный цикл Playwright, regex-проб, разбор OSV/crt.sh, кеш DNS |
| `src/app/` (веб) | UI, localStorage-состояние (ключи не менять), подписки, i18n | POST `/api/scan` — контракт прежний + новые поля; UI-компоненты отчёта | — |
| `src/cli/` | терминальный рендер, флаги, exit codes | bin `a11ylens` (`scan <url> [--json] [--csv] [--security-only] [--a11y-only] [--max-pages N] [--timeout ms] [--fail-under N] [--mode quick\|normal\|deep]`) | — |
| `desktop/` | Tauri-окно, установщик NSIS, первый запуск (этика + докачка Chromium), режимы интенсивности, локальная история сканов | артефакт `a11ylens-engine.exe` (sidecar = CLI-движок, Node SEA) | — |
| `tests/` + `tests/fixtures/` | юнит-тесты (vitest), HTML/заголовочные фикстуры, self-scan страница | `npm test`, `npm run scan:self` | — |

### Контракты, которые нельзя нарушать

- **ScanResult-модель** — единственная: веб-отчёт, CLI-рендер и десктоп читают один тип. Новые поля — additive; существующие поля и localStorage-ключи (`a11ylens:*` — точный список в `notes.md`) не переименовываются и не меняют форму (R08i).
- **`SecurityFinding` получает `evidence: string`** — доказательство находки; без evidence проверка не считается сработавшей.
- **Скоринг только в `engine/scoring.ts`** — веса критичности (impact) и severity задаются в одном месте; никакая поверхность не считает скор сама.
- **`SECURITY_CHECKS`-реестр** — источник для `checksRun` и для списка проверок в UI; никакого хардкода количества.
- **Скан чужого сайта — только пассивные/лёгкие проверки**; порты — топ-100 с таймаутом 1с; никаких брутфорсов и нагрузочных проб. Режимы `quick|normal|deep` меняют паузы/таймауты/лимиты, не набор векторов.
- **Внешние вызовы — только бесплатные и без ключей**: OSV, crt.sh. Новый внешний сервис = вопрос пользователю.

### Швы для тестов

`scoring.ts` (чистая функция), security-проверки (вход: фикстура заголовков + HTML, выход: находки), `advice/knowledge` (чистые словари), `normalizeUrl`/SSRF-фильтр (чистые), `scan-diff.ts` (чистый). `runScan` целиком не юнит-тестируется — его покрывает self-scan.

### Команды и стек (для исполнителей)

- Стек: Next.js 16.4.3 App Router, React 19, Tailwind 4, TypeScript 5 strict, Playwright 1.64 + axe-core 4.14, Node ≥18.18. Десктоп: Tauri 2 (только Windows-таргет).
- Установка: `npm install`; браузеры сканера: `npx playwright install chromium`.
- Запуск веба: `npm run dev` (:3000). Сборка: `npm run build`.
- **Единая проверка: `npm test`** (vitest: юнит + типы; появится в таске 01 — до неё проверка `npm run build`). Один файл: `npx vitest run tests/security.test.ts`.
- Тесты не ходят в сеть: внешние ответы — фикстуры/моки. Self-scan: `npm run scan:self` (поднимает локальную фикстурную страницу).
- Не трогать: localStorage-ключи и форму их значений; контракт POST `/api/scan` для старых полей; `.autopilot/`; `docs/screenshots/`.

### Правила проекта (Договорились с пользователем)

- Реальный ИИ-провайдер не подключаем вообще — разбор только правилами и эвристиками («его отмена»).
- Десктоп только под Windows («без линукса»).
- Проверка на «кибератаку» = поиск слабых мест, не детект идущих атак.
- HIBP и платные API — нет.

## Что построили закончившиеся таски

**T01 (движок, R01).** `src/engine/`: `runScan(opts: ScanOptions): Promise<ScanResult>` (ScanOptions = ScanRequest + `allowPrivateNetwork?`); `normalizeUrl(raw, {allowPrivateNetwork?})`, `assertPublicHttpUrl(url)`; реестр `SECURITY_CHECKS` (20 × {id, area, title}) → `buildSecurityAudit(findings)` считает `checksRun`; `failedSecurityAudit(reason)`; `IMPACT_WEIGHTS`/`IMPACT_ORDER`/`SEVERITY_WEIGHTS`/`computeAccessibilityScore`/`computeSecurityScore`; `withTimeout(promise, ms, msg)`; `SecurityAudit.error?: string` (additive). `src/lib/types.ts` реэкспортирует engine/types; `src/lib/scan-submit.ts` — `submitScan(): ScanSubmission`. Скрипты: `npm test` (vitest, 108 тестов), `npm run scan:self`. vitest@^3 (не 5 — конфликт с @types/node@20). `src/lib/security.ts` удалён — импорты из `src/engine/`.

**T02 (глубина и разбор, R02+R03).** `ScanOptions.maxPages` (clamp 1–10, default 4); `ScanResult.pages?: ScannedPage[]`; `Violation.pageUrl?/why?`; `SecurityFinding.evidence?/why?` — всё additive. `engine/scan.ts`: `pickInternalLinks`, `aggregatePages`, `attachEvidence`, `withFetchRecorder`, `redactBody`, `clampMaxPages`. `engine/report.ts`: `classifyScanError` → `ScanFailure{kind,title,detail,checks}`, `formatScanFailure`, `simulateScores(result, fixedIds)`, `buildRemediationPlan`, `isCleanReport`, `EFFORT_LABELS`. `engine/advice/`: `tipFor`, `RULE_TIPS`, `buildAdvice`, `ENGINE_OPTIONS`, `categoryOf`, `whyForRule`, `whyForSecurity` — словарь советов переехал из lib; `@/lib/knowledge` реэкспортирует всё. Швы для CLI/десктопа: глубокие импорты `@/engine/report|scan|advice` (engine/index.ts не расширялся). При `security.error` UI показывает ошибку аудита, не «проблем нет» (закрыт BLOCKING ревью T01).

**T03 (нативные проверки и CLI, R05+G01+A01).** `runNativeAudit(url, mode?: "quick"|"normal"|"deep", deps?): Promise<NativeReport>`; `NativeReport{score,findings,checksRun,technologies,subdomains,openPorts,degradations,error?}`; `NativeFinding{id,title,severity,detail,evidence,recommendation}`; `NATIVE_CHECKS` (6, источник checksRun); `NATIVE_MODES`; `auditTls/scanPorts/findSubdomains/checkLibraryCves/auditEmailSecurity/detectTechnologies` — все с injectable-зависимостями; `createTxtCache(resolveTxt)`. CLI: bin `a11ylens` → `src/cli/bin.mjs` (Node ≥22.6 type-stripping + резолв-хук, без сборки), `npm run cli`; флаги `--json --csv --security-only --a11y-only --max-pages --timeout --fail-under --mode`; exit 0/1/2. Зависимости: commander, picocolors.

**T05 (интерфейс, R06).** `src/lib/theme.tsx`: `useTheme(): {theme: "light"|"dark"|"system"; setTheme(next); cycleTheme()}`, `<ThemeToggle className?>`, `applyTheme(pref)` → `data-theme` + класс `dark` на `<html>`; localStorage `a11ylens:theme:v1` (additive). CSS-швы: токен `--accent`, `[data-theme="dark"]`, `@media(prefers-color-scheme:dark){[data-theme="system"]}`, `@utility skeleton-shimmer`; `DictKey` += theme.toggle/light/dark/system. Тест контраста: `tests/ui/theme-contrast.test.ts` (axe на токенах обеих тем).

**T04 (Windows-приложение, R04).** `desktop/`: Tauri 2 invoke-команды `load_state/save_state(AppState{ethicsAccepted,chromiumConsent,theme})`, `load_history/save_history`, `check_browser()→BrowserStatus`, `run_engine(args)→EngineRun{exitCode,stdout,stderr}`, `install_browser()`. Sidecar-протокол: stdout `{scan:ScanResult, native:NativeReport|null}` (CLI `--json`); `MODES quick|normal|deep` → `--mode/--max-pages 2|4|8/--timeout 45|90|180с`; резолв движка: `A11YLENS_ENGINE` env → рядом с exe → ресурс → dev-фолбэк `node src/cli/bin.mjs`. Сборка: `npm run tauri build` в `desktop/` → NSIS+MSI; sidecar SEA: `scripts/build-sidecar.mjs`. Свой vitest-конфиг: `npx vitest run --config desktop/vitest.config.mts` (34 теста). История сканов — файл в app data, не localStorage. R04.3: продолжение после обрыва = повтор недосканированных страниц через `--max-pages=остаток` (пер-страничного оффсета в CLI-контракте нет — механика в desktop/README.md).

**F1 (ремонт ветки, R01+R02.1+R08i).** `SEVERITY_ORDER: Record<SecuritySeverity, number>` — экспорт из `engine/scoring.ts` (и через engine/index); `IMPACT_ORDER` доступен из `@/lib/types` (тот же объект, без копий). `probeSensitiveFiles` — пробы с `redirect: "manual"`, 3xx = проба не удалась (без находки, тело не читается). `withFetchRecorder` — восстановление только `if (globalThis.fetch === recorded)`. Словари порядка в src/ — единственный источник `engine/scoring.ts` (grep чист).






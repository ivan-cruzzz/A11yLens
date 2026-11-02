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

*(заполняется по мере сдачи тасков)*

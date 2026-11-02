# Архитектура A11yLens

Сканер доступности (WCAG 2.2) и кибербезопасности сайтов: веб (Next.js), CLI, Windows-десктоп (Tauri). Стек: Next.js 16 App Router, React 19, Tailwind 4, TypeScript 5 strict, Playwright + axe-core, vitest; десктоп — Tauri 2 + sidecar (Node SEA).

## Единицы и владение

| Единица | Владеет | Экспортирует (шов) | Скрывает |
|---|---|---|---|
| `src/engine/` | конвейер сканирования, реестр security-проверок, нативные проверки (TLS/порты/поддомены/CVE/почта), скоринг, модель отчёта, словарь советов | `runScan(options)` (run-scan.ts), `runSecurityAudit(url, init)` (security.ts), `runNativeAudit(url, mode)` (native/) — только CLI/десктоп; `IMPACT_WEIGHTS`, `SEVERITY_WEIGHTS`, `SECURITY_CHECKS`, типы `ScanResult`/`Violation`/`SecurityFinding`/`NativeFinding`; `normalizeUrl`, `assertPublicHttpUrl` (url-guard.ts, SSRF-фильтр) | жизненный цикл Playwright, regex-проб, разбор OSV/crt.sh, кеш DNS |
| `src/app/` (веб) | UI, localStorage-состояние (ключи `a11ylens:*` — не переименовывать), подписки, i18n (`src/lib/i18n.tsx`) | POST `/api/scan` (`src/app/api/scan/route.ts`) → `runScan` → один `ScanResult`; UI-компоненты отчёта | — |
| `src/cli/` | терминальный рендер (`render.ts`), флаги, exit codes (`scan-command.ts`) | bin `a11ylens` → `bin.mjs` (Node ≥22.6 type-stripping + `ts-hooks.mjs`, без сборки): `scan <url> [--json] [--csv] [--security-only] [--a11y-only] [--max-pages N] [--timeout ms] [--fail-under N] [--mode quick\|normal\|deep]`; exit 0 — успех, 1 — ниже `--fail-under`, 2 — ошибка скана | — |
| `desktop/` | Tauri-окно, установщик NSIS, первый запуск (этика + докачка Chromium), режимы интенсивности, локальная история сканов (файл в app data, не localStorage) | артефакт `a11ylens-engine.exe` — sidecar, тот же CLI-движок как Node SEA (`scripts/build-sidecar.mjs`, конфиг `sidecar/sea-config.json`); invoke-команды `load_state/save_state`, `load_history/save_history`, `check_browser`, `run_engine`, `install_browser` | — |
| `tests/` | юнит-тесты (vitest) по зонам: security, native, report, cli, ui, advice, fixtures | `npm test`; self-scan — `npm run scan:self` (`vitest.self.config.ts`) | — |

## Поток данных

- Веб: UI → POST `/api/scan` → `runScan` → `ScanResult` → рендер отчёта; состояние — localStorage `a11ylens:*`.
- CLI: `bin.mjs` → `scan-command.ts` → `runScan` + `runNativeAudit` → текст/JSON/CSV.
- Десктоп: Tauri invoke `run_engine` → sidecar `a11ylens-engine.exe` (CLI `--json`) → stdout `{scan: ScanResult, native: NativeReport | null}`; резолв движка: env `A11YLENS_ENGINE` → рядом с exe → ресурс → dev-фолбэк `node src/cli/bin.mjs`.

## Контракты, которые нельзя нарушать

- `ScanResult` — единственная модель: веб, CLI и десктоп читают один тип (`src/lib/types.ts` реэкспортирует engine/types). Новые поля — только additive; старые поля и localStorage-ключи не переименовываются и не меняют форму.
- `SecurityFinding.evidence: string` — без доказательства проверка не считается сработавшей.
- Скоринг только в `src/engine/scoring.ts`: веса impact/severity и словари порядка (`IMPACT_ORDER`, `SEVERITY_ORDER`) — в одном месте, копий не заводить; никакая поверхность не считает скор сама.
- `SECURITY_CHECKS` (20) и `NATIVE_CHECKS` (6) — реестры-источники для `checksRun` и списков в UI; никакого хардкода количества.
- Скан чужого сайта — только пассивные/лёгкие проверки; порты — топ-100 с таймаутом 1с; без брутфорсов и нагрузочных проб. Режимы `quick|normal|deep` меняют паузы/таймауты/лимиты, не набор векторов.
- Внешние вызовы — только бесплатные и без ключей: OSV, crt.sh. Новый внешний сервис = вопрос пользователю.
- Реальный ИИ-провайдер не подключается — разбор только правилами и эвристиками (`src/engine/advice/`); HIBP и платные API — нет. Десктоп — только Windows. «Кибератака» = поиск слабых мест, не детект идущих атак.

## Швы для тестов

Чистые и тестируемые: `scoring.ts`, security-проверки (вход: фикстура заголовков + HTML → находки), `advice/` (словари), `url-guard.ts`, `src/lib/scan-diff.ts`. `runScan` целиком не юнит-тестируется — его покрывает self-scan (`npm run scan:self`, локальная фикстурная страница). Тесты не ходят в сеть — внешние ответы фикстуры/моки. Глубокие швы для CLI/десктопа: импорты `@/engine/report`, `@/engine/scan`, `@/engine/advice`, `@/engine/native`.

## Не трогать

localStorage-ключи и форму их значений; контракт POST `/api/scan` для старых полей; `.autopilot/`; `docs/screenshots/`. Решения «почему так» — `docs/adr/` (ADR-001…005: общий движок, советы без ИИ, Tauri-sidecar Windows-only, этика нативных проверок, единый скоринг).

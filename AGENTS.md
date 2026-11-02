<!-- autopilot:start -->
# A11yLens

Сканер доступности (WCAG 2.2) и кибербезопасности сайтов: веб на Next.js, CLI и Windows-десктоп (Tauri).

## Команды

| Команда | Что делает |
|---------|------------|
| `npm install` | зависимости |
| `npm run build` | продакшен-сборка Next.js |
| `npm test` | все тесты vitest (19 файлов; браузерные — skip без Playwright-браузеров) |
| `npx vitest run tests/security.test.ts` | один файл тестов |
| `npm run cli -- scan <url> [--json\|--csv\|--security-only\|--a11y-only\|--max-pages N\|--timeout ms\|--fail-under N\|--mode quick\|normal\|deep]` | CLI-скан; exit 0 — успех, 1 — ниже `--fail-under`, 2 — ошибка скана |
| `npm run scan:self` | self-scan локальной фикстурной страницы (нужен Playwright-браузер) |
| `cd desktop && npm install && npm test` | тесты десктопа (34) |
| `cd desktop && npm run build:sidecar && npm run tauri build` | сборка десктопа: NSIS/MSI в `desktop/src-tauri/target/release/bundle/` |

## Где что

- `src/engine/` — движок сканера: `runScan` (`run-scan.ts`), `runNativeAudit` (`native/`), реестры проверок `SECURITY_CHECKS`/`NATIVE_CHECKS`; скоринг — `scoring.ts` (словари весов и порядков — единственный источник).
- `src/engine/advice/` — словари советов и объяснений без ИИ (`RULE_TIPS`, `tipFor`).
- `src/cli/` — терминальный клиент: `bin.mjs` (bin `a11ylens`), флаги и exit codes — `scan-command.ts`.
- `desktop/` — Tauri-приложение Windows: sidecar SEA — `scripts/build-sidecar.mjs`, механика продолжения скана — `desktop/README.md`.
- `tests/` — vitest по зонам (security, native, report, cli, ui) + `tests/fixtures/`.
- `docs/IDEAS.md` — идеи развития.

## Подводные камни

- Playwright-браузеры обязательны для браузерного скана и self-scan: `npx playwright install chromium` (в этой среде CDN гео-блок — браузеров нет, браузерные тесты skip).
- vitest — ^3, не 5: vitest@5 конфликтует с `@types/node@20`.
- Словари порядков (`IMPACT_ORDER`, `SEVERITY_ORDER`) — только из `src/engine/scoring.ts`, копий не заводить.
- Sidecar SEA патчит якоря playwright-core (`desktop/scripts/build-sidecar.mjs`) — апгрейд playwright ломает сборку sidecar.
- Node ≥22.6 для CLI: `src/cli/bin.mjs` работает type-stripping'ом, без сборки.

## Окружение

- `A11YLENS_ENGINE` — путь к sidecar-движку для десктопа (резолв: env → рядом с exe → ресурс → dev-фолбэк `node src/cli/bin.mjs`).

## Архитектура

Единицы, границы, контракты, швы для тестов — `docs/architecture.md`; решения «почему так» — `docs/adr/`.

## Как здесь работает Autopilot

Сборка ведётся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/`.
Прогресс — `.autopilot/dashboard.html`. Требование из `manifest.md` может снять
только пользователь. Прерванную сборку продолжает «продолжи автопилот».

### Правка без автопилота

Мелкий баг или доводка после сборки — обычная сессия, без прогона.

Сначала прочитай:
1. `.autopilot/PROGRESS.md` — что не доделано, известные баги, о чём договорились с пользователем.
2. Что правили после последней сборки — первая строка таблицы в «История git».
3. Только если правка их касается: почему сделано так — `docs/adr/`; что значат слова — `CONTEXT.md`;
   что именно просили — `manifest.md` в папке сборки (указана в начале `PROGRESS.md`).

После правки:
- коммит — по правилам из «История git»;
- строка в «Правки без автопилота» в `PROGRESS.md`: дата — что — почему;
- починенный пункт из «Не доделано» или «Известные баги» — удали;
- договорились с пользователем о том, что следующая сборка не должна пересматривать, —
  строка в «Договорились», его словами.

### История git

Целиком не читай — бери срез под вопрос:

| Вопрос | Команда |
|---|---|
| что правили после последней сборки | `git log --oneline "$(git log -1 --format=%h --grep='^Autopilot: сборка сдана')"..HEAD -- . ':(exclude).autopilot'` |
| всё, что делали ради требования | `git log --oneline --grep="R02"` |
| история файла | `git log --oneline -10 -- <файл>` |
| когда появился или исчез код | `git log --oneline -S "<фрагмент>"` |
| почему строка такая | `git blame -L <с>,<по> <файл>`, затем `git show <sha>` |
| что внутри коммита | `git show --stat <sha>` |

Срез длиннее ~30 коммитов — отдай его субагенту и возьми выжимку в десять строк.

Коммит: заголовок — что (`fix: даты в одном формате`), тело — почему, трейлер
`--trailer "Requirements: R02"`, если правка касается требования из `manifest.md`.
Заголовок `Autopilot: сборка сдана` пишет только автопилот — по нему находят последнюю сборку.
<!-- autopilot:end -->

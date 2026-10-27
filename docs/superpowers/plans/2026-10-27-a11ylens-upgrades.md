# A11yLens Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native — выбрано пользователем: «приступай») to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Регистрация с выбором лица, мок-подписки с гейтингом и полиш вёрстки отчёта — по спеке.

**Architecture:** Без БД и сервера: аккаунт, план и счётчик проверок — localStorage (`lib/account.ts`, `lib/subscription.ts`). Новые маршруты `/register` и `/pricing` — клиентские компоненты. Гейтинг — перед запуском сканирования. Вёрстка — правки существующих классов.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4, существующие kokonutui-компоненты (ProfileDropdown, AvatarPicker/FaceArt/createFace, LightboxGrid).

**Spec:** `docs/superpowers/specs/2026-10-27-a11ylens-upgrades-design.md`

## Global Constraints

- Проект НЕ git-репозиторий — шаги коммита заменяются шагом «build».
- Тестового раннера нет; проверка каждой задачи — `npx next build` (типы + компиляция), финал — сценарий в браузере.
- Монохромная чёрная палитра: никаких цветных Tailwind-классов (emerald/red/amber/…), только zinc/foreground/border/muted.
- Токены storage: `a11ylens:account:v1`, `a11ylens:plan:v1`, `a11ylens:usage:v1`. Даты: ISO 8601 (createdAt), `YYYY-MM-DD` (usage date).
- Пароль нигде не сохраняется и не отправляется.

## Review Focus

- localStorage недоступен (SSR/приватный режим) → все lib-функции возвращают дефолт, без исключений. Проверка: Task 1/2 try/catch + build.
- `?next=` внешний URL (`https://…`, `//evil.com`) → редирект на `/scan`. Проверка: Task 3, валидация в коде.
- Смена дня → `getUsageToday()` сбрасывает счётчик без записи при чтении. Проверка: Task 2, логика `canScan`.
- Лимит Free при массовой проверке → каждый целевой URL считается отдельным сканом. Проверка: Task 7.
- Выход не должен удалять историю (только `clearAccount`). Проверка: Task 5.

---

### Task 1: lib/account.ts

**Files:**
- Create: `src/lib/account.ts`

**Interfaces:**
- Produces: `type Account = { displayName: string; email: string; avatar: { displayName: string; variant: number }; siteName: string; createdAt: string }`; `loadAccount(): Account | null`; `saveAccount(a: Account): Account`; `clearAccount(): null`; `registerPathIfNeeded(next: string): string` — возвращает `/register?next=<encodeURIComponent(next)>` если аккаунта нет, иначе `next`.
- Pattern: как `src/lib/history.ts` (try/catch, `typeof window` guard). Лицо потребители строят сами через `createFace(avatarSeed(avatar.displayName, avatar.variant))`.

- [ ] **Step 1:** Реализовать модуль (ключ `a11ylens:account:v1`, валидация `next`: только строки, начинающиеся с `/` и не с `//`).
- [ ] **Step 2:** `npx next build` → PASS.

### Task 2: lib/subscription.ts

**Files:**
- Create: `src/lib/subscription.ts`

**Interfaces:**
- Produces: `type PlanId = "free" | "pro" | "business"`; `type Plan = { id: PlanId; name: string; priceRub: number; scansPerDay: number | null; bulk: boolean; pdf: boolean }`; `const PLANS: Record<PlanId, Plan>` (free: 0₽/5/−/−, pro: 990₽/100/bulk/pdf, business: 2990₽/null/bulk/pdf); `getPlan(): Plan`; `setPlan(id: PlanId): Plan`; `getUsageToday(): { date: string; count: number }`; `recordScan(): void` (+1 к счётчику); `canScan(): boolean` (сброс счётчика при смене локального дня, `null`-лимит = всегда true).
- Keys: `a11ylens:plan:v1`, `a11ylens:usage:v1`. Дефолт плана — `free`.

- [ ] **Step 1:** Реализовать модуль (guard'ы как в Task 1).
- [ ] **Step 2:** `npx next build` → PASS.

### Task 3: Страница /register

**Files:**
- Create: `src/app/register/page.tsx`

**Interfaces:**
- Consumes: `saveAccount`, `loadAccount`, валидация `next` (Task 1); `avatarSeed`, `createFace`, `FaceArt`, тип `Face` из `components/kokonutui/avatar-picker.tsx`.
- Produces: маршрут `/register?next=…`, после создания аккаунта — `router.replace(validNext)`.

- [ ] **Step 1:** Каркас: client-компонент с `useSearchParams` в `Suspense` (по образцу `app/scan/page.tsx`), хедер как на лендинге (лого + ссылка «На главную»). Если аккаунт уже есть — `router.replace(next)` в `useEffect`.
- [ ] **Step 2:** Шаг 1: поля имя/email/пароль/подтверждение, клиентская валидация (все непустые, email по `/.+@.+\..+/`, пароль ≥ 8), ошибки под полями (`role="alert"`). «Далее».
- [ ] **Step 3:** Шаг 2: предпросмотр лица `<FaceArt face={createFace(avatarSeed(name, variant))} className="size-24 rounded-full" />` + кнопка «Другое лицо» (variant+1), поле «Название сайта» (предзаполнено хостом из `next`, если там есть `url=`), кнопка «Создать аккаунт» → `saveAccount` → `router.replace(next)`.
- [ ] **Step 4:** `npx next build` → PASS.

### Task 4: Аккаунт-гейт CTA и профиль на лендинге

**Files:**
- Create: `src/components/app/landing-nav.tsx` (client)
- Modify: `src/app/page.tsx` (навигация в шапке → `<LandingNav />`)
- Modify: `src/components/app/hero-form.tsx` (редирект через регистрацию)

**Interfaces:**
- Consumes: `registerPathIfNeeded` (Task 1); `loadAccount` (Task 1); `FaceArt` (для аватара в шапке лендинга).
- Produces: `LandingNav` — client-навигация шапки лендинга: ссылки «Возможности»/«Как это работает», CTA `href={registerPathIfNeeded("/scan")}`, при наличии аккаунта — компактный профиль (аватар + имя, клик → `/scan`).

- [ ] **Step 1:** `HeroForm.start()`: `router.push(registerPathIfNeeded(`/scan?url=${encodeURIComponent(target)}`))`.
- [ ] **Step 2:** `LandingNav`; в `page.tsx` заменить блок `<nav>` шапки. Отступ профиля от края (пп. 7) — класс-обёртка.
- [ ] **Step 3:** `npx next build` → PASS.

### Task 5: Реальный профиль на /scan и выход

**Files:**
- Modify: `src/app/scan/page.tsx` (шапка: аккаунт, меню, отступ профиля)

**Interfaces:**
- Consumes: `loadAccount`/`clearAccount` (Task 1); `createFace`, `avatarSeed` (avatar-picker); `getPlan` (Task 2); существующие пропсы `ProfileDropdown` (`accounts: Account[]`, `items`, `onSignOut`).
- Produces: accounts = `[{ id: "local", name: account.displayName, email: account.email, plan: getPlan().name }]`; новый пункт меню «Управление подпиской» → `router.push("/pricing")`; `onSignOut` = `clearAccount()` + `router.push("/")` (история не трогается). Нет аккаунта при входе на `/scan` → редирект на `/register?next=…` в `useEffect`.

- [ ] **Step 1:** Состояние аккаунта + редирект-гейт; пропсы ProfileDropdown; пункт меню подписки; отступ профиля от верхнего края (пп. 7).
- [ ] **Step 2:** `npx next build` → PASS.

### Task 6: /pricing + мок-оплата

**Files:**
- Create: `src/components/app/plan-cards.tsx` (client)
- Create: `src/components/app/checkout-modal.tsx` (client)
- Create: `src/app/pricing/page.tsx`

**Interfaces:**
- Consumes: `PLANS`, `getPlan`, `setPlan`, `PlanId` (Task 2).
- Produces: `PlanCards({ currentPlanId, onCheckout }: { currentPlanId: PlanId; onCheckout: (id: PlanId) => void })`; `CheckoutModal({ plan, open, onClose, onSuccess }: { plan: Plan | null; open: boolean; onClose: () => void; onSuccess: () => void })` — маска карты `#### #### #### ####`, срок `MM/ГГ`, CVC 3 цифры, кнопка «Оплатить N ₽» с pending ~1.2 с → «Подписка оформлена» → `setPlan`. Free — подтверждение текстом в той же модалке, без формы карты.

- [ ] **Step 1:** `PlanCards`: 3 карточки `rounded-2xl border bg-card/50 p-6`, Pro — `border-foreground/40`, фичи списком с иконками Check/X (zinc), кнопки в стиле кнопок лендинга.
- [ ] **Step 2:** `CheckoutModal`: fixed-оверлей `bg-black/70 backdrop-blur`, Esc/клик по фону закрывают, `role="dialog" aria-modal`, фокус в первое поле.
- [ ] **Step 3:** `app/pricing/page.tsx`: шапка-минимум (лого + «На главную»), сетка PlanCards, состояние модалки, после onSuccess — обновление текущего плана.
- [ ] **Step 4:** `npx next build` → PASS.

### Task 7: Гейтинг сканирования

**Files:**
- Create: `src/components/app/limit-modal.tsx` (client)
- Modify: `src/app/scan/page.tsx`

**Interfaces:**
- Consumes: `canScan`, `recordScan`, `getPlan`, `getUsageToday` (Task 2).
- Produces: `LimitModal({ open, used, limit, onClose }: { open: boolean; used: number; limit: number; onClose: () => void })` — «Лимит исчерпан», кнопки «Оформить Pro» (`/pricing`) и «Попробовать завтра».
- В scan/page: перед `runScan` и перед каждым `scanBulk` — `if (!canScan()) { открыть модалку; return }`; после успешного ответа — `recordScan()`. Массовая проверка и PDF при `!plan.bulk`/`!plan.pdf` — иконка замка + подпись «Pro», клик → `/pricing`, действие не выполняется.

- [ ] **Step 1:** `LimitModal` (по образцу CheckoutModal, проще).
- [ ] **Step 2:** Врезка гейтов в `runScan`/`scanBulk`/`exportPdf`/секцию «Массовая проверка».
- [ ] **Step 3:** `npx next build` → PASS.

### Task 8: Вёрстка (пп. 2, 3, 4, 6, 8)

**Files:**
- Modify: `src/app/scan/page.tsx` (пп. 2, 4-экспорт, 8)
- Modify: `src/components/kokonutui/lightbox-grid.tsx` (п. 3 — плитки)

**Interfaces:**
- Consumes: существующие `LightboxGrid({ images })`, `SlideToConfirm`, `WidgetGrid`.

- [ ] **Step 1 (п. 2):** Секция прогресса: во время сканирования — одна колонка `mx-auto w-full max-w-md` (CurrencyTransfer, Loader ниже); когда `result` готов — CurrencyTransfer скрыт, первым блоком идёт бенто. Заголовок «Отчёт: …» + SlideToConfirm — `flex flex-wrap items-center gap-3`.
- [ ] **Step 2 (п. 3):** Контент вкладок нарушений: `grid gap-3 sm:grid-cols-2 items-start`; пустое состояние — `sm:col-span-2`. В `lightbox-grid.tsx`: плитки — единый `aspect-[4/3]`, `object-cover`, фон `bg-card`; больше 12 изображений — плитка «+N ещё», раскрывающая остальные (локальный state).
- [ ] **Step 3 (п. 4):** «Сохранить и поделиться»: карточкам `h-full flex flex-col`, PDF-кнопка `mt-auto`, стиль нейтральный.
- [ ] **Step 4 (п. 8):** Ритм секций `/scan`: заголовки `mt-12/16`, карточки единообразно `rounded-2xl border border-border bg-card/50`, футер — `py-8`.
- [ ] **Step 5:** `npx next build` → PASS.

### Task 9: Финальная проверка

- [ ] **Step 1:** `npx next build` → PASS (чистая).
- [ ] **Step 2:** Браузерный сценарий (chrome-devtools, ignoreCache): лендинг → CTA → /register (2 шага, «Другое лицо») → /scan → скан example.com → бенто → /pricing → оформление Pro → массовая проверка и PDF доступны → выход. Скриншоты ключевых экранов, только монохром.

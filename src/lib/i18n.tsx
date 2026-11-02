"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type Locale = "ru" | "en";

const LOCALE_KEY = "a11ylens:locale:v1";

export const DICT = {
  ru: {
    "nav.features": "Возможности",
    "nav.how": "Как это работает",
    "nav.openScanner": "Открыть сканер",
    "nav.toScanner": "К сканеру",
    "nav.home": "На главную",
    "hero.badge": "WCAG 2.2 · axe-core · Playwright",
    "hero.title": "Проверьте сайт на доступность за минуту",
    "hero.subtitle":
      "Введите URL — получите отчёт по контрастам, alt-текстам и клавиатурной навигации, скриншоты нарушений и AI-советы по исправлению.",
    "hero.cta": "Проверить сайт",
    "hero.placeholder": "https://example.com",
    "hero.example": "Пример: example.com · wikipedia.org · gov.ru",
    "scan.check": "Проверить",
    "scan.urlLabel": "Адрес страницы",
    "scan.standard": "Стандарт доступности",
    "scan.device": "Устройство",
    "scan.desktop": "Десктоп",
    "scan.mobile": "Мобильный",
    "scan.bulk": "Массовая проверка",
    "scan.bulkLocked": "Массовая проверка доступна на тарифах Pro и Business.",
    "scan.seePlans": "Смотреть тарифы",
    "scan.history": "История проверок",
    "scan.stats": "Моя статистика",
    "scan.exportPdf": "Скачать PDF-отчёт",
    "scan.exportJson": "Экспорт JSON",
    "scan.exportCsv": "Экспорт CSV",
    "scan.watch": "Следить за сайтом",
    "scan.save": "Сохранить отчёт",
    "scan.violations": "Нарушения",
    "scan.screenshots": "Скриншоты нарушений",
    "scan.share": "Сохранить и поделиться",
    "scan.scanning": "Идёт сканирование",
    "scan.done": "Скан завершён — отчёт готов",
    "pricing.title": "Тарифы",
    "pricing.subtitle":
      "Демо-режим: оплата не проводится, план активируется сразу и хранится в вашем браузере.",
    "register.step": "Шаг",
    "register.of": "из",
    "register.createTitle": "Создайте аккаунт",
    "register.faceTitle": "Выберите лицо отчёта",
    "register.name": "Имя",
    "register.email": "E-mail",
    "register.password": "Пароль",
    "register.passwordAgain": "Повторите пароль",
    "register.next": "Далее",
    "register.create": "Создать аккаунт",
    "register.otherFace": "Другое лицо",
    "register.siteName": "Название сайта",
    "guide.title": "Гайд по WCAG 2.2",
    "guide.toScanner": "К сканеру",
    "theme.toggle": "Тема",
    "theme.light": "Светлая",
    "theme.dark": "Тёмная",
    "theme.system": "Системная",
    "common.currentPlan": "Текущий план",
    "features.title": "Что покажет отчёт",
    "features.subtitle":
      "Карточки можно перетаскивать и менять размер — как на настоящей панели мониторинга.",
    "how.title": "Как проходит сканирование",
    "how.cta": "Попробовать сейчас",
    "how.demoCaption":
      "Прогресс сканирования живёт на такой карточке — шаги переключаются в реальном времени:",
    "step1.title": "Вставьте URL",
    "step1.text":
      "Или загрузите HTML-файл либо CSV со списком адресов для массовой проверки.",
    "step2.title": "Playwright + axe-core",
    "step2.text":
      "Открываем страницу в настоящем браузере и прогоняем 60+ правил WCAG 2.2.",
    "step3.title": "Читаемый отчёт",
    "step3.text":
      "Счётчик доступности, скриншоты нарушений, AI-советы и экспорт в PDF.",
    "footer.tagline": "инструмент проверки доступности",
  },
  en: {
    "nav.features": "Features",
    "nav.how": "How it works",
    "nav.openScanner": "Open scanner",
    "nav.toScanner": "To scanner",
    "nav.home": "Home",
    "hero.badge": "WCAG 2.2 · axe-core · Playwright",
    "hero.title": "Check your site's accessibility in a minute",
    "hero.subtitle":
      "Enter a URL — get a report on contrast, alt texts and keyboard navigation, violation screenshots and AI fix tips.",
    "hero.cta": "Check website",
    "hero.placeholder": "https://example.com",
    "hero.example": "Example: example.com · wikipedia.org · gov.ru",
    "scan.check": "Check",
    "scan.urlLabel": "Page address",
    "scan.standard": "Accessibility standard",
    "scan.device": "Device",
    "scan.desktop": "Desktop",
    "scan.mobile": "Mobile",
    "scan.bulk": "Bulk scanning",
    "scan.bulkLocked": "Bulk scanning is available on Pro and Business plans.",
    "scan.seePlans": "See plans",
    "scan.history": "Scan history",
    "scan.stats": "My statistics",
    "scan.exportPdf": "Download PDF report",
    "scan.exportJson": "Export JSON",
    "scan.exportCsv": "Export CSV",
    "scan.watch": "Watch this site",
    "scan.save": "Save report",
    "scan.violations": "Violations",
    "scan.screenshots": "Violation screenshots",
    "scan.share": "Save and share",
    "scan.scanning": "Scanning",
    "scan.done": "Scan finished — report ready",
    "pricing.title": "Pricing",
    "pricing.subtitle":
      "Demo mode: no real payment, the plan activates instantly and is stored in your browser.",
    "register.step": "Step",
    "register.of": "of",
    "register.createTitle": "Create an account",
    "register.faceTitle": "Pick a report face",
    "register.name": "Name",
    "register.email": "E-mail",
    "register.password": "Password",
    "register.passwordAgain": "Repeat password",
    "register.next": "Next",
    "register.create": "Create account",
    "register.otherFace": "Another face",
    "register.siteName": "Site name",
    "guide.title": "WCAG 2.2 guide",
    "guide.toScanner": "To scanner",
    "theme.toggle": "Theme",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.system": "System",
    "common.currentPlan": "Current plan",
    "features.title": "What the report shows",
    "features.subtitle":
      "Cards can be dragged and resized — like a real monitoring dashboard.",
    "how.title": "How scanning works",
    "how.cta": "Try it now",
    "how.demoCaption":
      "Scan progress lives on this card — steps switch in real time:",
    "step1.title": "Paste a URL",
    "step1.text": "Or upload an HTML file or CSV with a list of addresses.",
    "step2.title": "Playwright + axe-core",
    "step2.text":
      "We open the page in a real browser and run 60+ WCAG 2.2 rules.",
    "step3.title": "Readable report",
    "step3.text":
      "Accessibility score, violation screenshots, AI tips and PDF export.",
    "footer.tagline": "accessibility testing tool",
  },
} as const;

export type DictKey = keyof (typeof DICT)["ru"];

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "ru", setLocale: () => {} });

export function useLocale() {
  return useContext(LocaleContext);
}

/** t(key): перевод ключа на текущую локаль. */
export function useT() {
  const { locale } = useLocale();
  return useCallback(
    (key: DictKey) => DICT[locale][key] ?? DICT.ru[key],
    [locale]
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCALE_KEY);
      if (stored === "ru" || stored === "en") {
        setLocaleState(stored);
      }
    } catch {
      // Без хранилища — русская локаль.
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // Хранилище недоступно — локаль до перезагрузки.
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

/** Переключатель RU/EN для шапки. */
export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div
      aria-label="Language / Язык"
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-border p-0.5",
        className
      )}
      role="group"
    >
      {(["ru", "en"] as const).map((code) => (
        <button
          aria-pressed={locale === code}
          className={
            locale === code
              ? "rounded-md bg-foreground/10 px-2 py-1 font-medium text-[11px] text-foreground"
              : "rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          }
          key={code}
          onClick={() => setLocale(code)}
          type="button"
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

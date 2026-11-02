"use client";

import {
  useCallback,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/** Выбор пользователя: «системная» следит за prefers-color-scheme. */
export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "a11ylens:theme:v1";
const THEME_EVENT = "a11ylens:theme";
const DARK_MEDIA = "(prefers-color-scheme: dark)";

function isPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (isPreference(stored)) {
      return stored;
    }
  } catch {
    // Хранилище недоступно — системная тема.
  }
  return "system";
}

function resolveDark(preference: ThemePreference): boolean {
  if (preference === "system") {
    return window.matchMedia(DARK_MEDIA).matches;
  }
  return preference === "dark";
}

/** Применяет выбор к <html>: data-theme — выбор, .dark — фактическая тема. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  root.dataset.theme = preference;
  root.classList.toggle("dark", resolveDark(preference));
}

/* --- Внешний стор поверх localStorage: любое число кнопок синхронно. --- */

let snapshot: ThemePreference = "system";
const listeners = new Set<() => void>();

function refresh() {
  const next = readPreference();
  if (next !== snapshot) {
    snapshot = next;
  }
}

function notify() {
  refresh();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener(THEME_EVENT, notify);
    window.addEventListener("storage", notify);
    // Системная тема меняется мимо localStorage — применяем сразу.
    window.matchMedia(DARK_MEDIA).addEventListener("change", () => {
      applyTheme(readPreference());
    });
    applyTheme(readPreference());
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemePreference {
  return snapshot;
}

function getServerSnapshot(): ThemePreference {
  return "system";
}

/** Текущий выбор темы и его смена; выбор живёт в localStorage. */
export function useTheme(): {
  theme: ThemePreference;
  setTheme: (next: ThemePreference) => void;
  cycleTheme: () => void;
} {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Хранилище недоступно — тема до перезагрузки.
    }
    applyTheme(next);
    notify();
  }, []);

  const cycleTheme = useCallback(() => {
    const order: ThemePreference[] = ["light", "dark", "system"];
    setTheme(order[(order.indexOf(snapshot) + 1) % order.length]);
  }, [setTheme]);

  return { theme, setTheme, cycleTheme };
}

const THEME_META: Record<
  ThemePreference,
  { icon: ReactNode; labelKey: "theme.light" | "theme.dark" | "theme.system" }
> = {
  light: { icon: <SunIcon aria-hidden="true" className="size-4" />, labelKey: "theme.light" },
  dark: { icon: <MoonIcon aria-hidden="true" className="size-4" />, labelKey: "theme.dark" },
  system: {
    icon: <MonitorIcon aria-hidden="true" className="size-4" />,
    labelKey: "theme.system",
  },
};

/**
 * Кнопка в шапке: показывает текущий выбор, клик переключает
 * светлая → тёмная → системная.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const t = useT();

  const order: ThemePreference[] = ["light", "dark", "system"];
  const next = order[(order.indexOf(theme) + 1) % order.length];

  return (
    <button
      aria-label={`${t("theme.toggle")}: ${t(THEME_META[theme].labelKey)} → ${t(THEME_META[next].labelKey)}`}
      className={cn(
        "inline-grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground",
        className
      )}
      onClick={() => setTheme(next)}
      title={`${t("theme.toggle")}: ${t(THEME_META[next].labelKey)}`}
      type="button"
    >
      {THEME_META[theme].icon}
      <span className="sr-only">
        {t("theme.toggle")}: {t(THEME_META[theme].labelKey)}
      </span>
    </button>
  );
}

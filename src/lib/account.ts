export interface Account {
  displayName: string;
  email: string;
  avatar: { displayName: string; variant: number };
  siteName: string;
  /** ISO 8601. */
  createdAt: string;
}

const KEY = "a11ylens:account:v1";

export function loadAccount(): Account | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

export function saveAccount(account: Account): Account {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(account));
    } catch {
      // Приватный режим / переполнение — аккаунт просто не сохранится.
    }
  }
  return account;
}

export function clearAccount(): null {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // Игнорируем: нечего чистить или хранилище недоступно.
    }
  }
  return null;
}

/** Только внутренние пути; всё остальное — /scan. */
export function normalizeNextPath(next: string | null | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/scan";
}

/**
 * Путь для CTA: если аккаунта нет — через регистрацию с возвратом,
 * иначе — сразу по назначению.
 */
export function registerPathIfNeeded(next: string): string {
  const target = normalizeNextPath(next);
  return loadAccount()
    ? target
    : `/register?next=${encodeURIComponent(target)}`;
}

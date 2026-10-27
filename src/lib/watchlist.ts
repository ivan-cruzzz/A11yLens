export interface WatchEntry {
  host: string;
  lastScore: number;
  prevScore: number | null;
  scannedAt: string; // ISO 8601
}

const KEY = "a11ylens:watchlist:v1";

export function loadWatchlist(): WatchEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WatchEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: WatchEntry[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Хранилище недоступно — список живёт до перезагрузки.
  }
}

export function isWatched(host: string): boolean {
  return loadWatchlist().some((entry) => entry.host === host);
}

export function addToWatchlist(host: string, score: number): WatchEntry[] {
  const entries = loadWatchlist().filter((entry) => entry.host !== host);
  const next = [
    {
      host,
      lastScore: score,
      prevScore: null,
      scannedAt: new Date().toISOString(),
    },
    ...entries,
  ];
  persist(next);
  return next;
}

export function removeFromWatchlist(host: string): WatchEntry[] {
  const next = loadWatchlist().filter((entry) => entry.host !== host);
  persist(next);
  return next;
}

/** Обновляет запись после рескана и возвращает прежний балл (для бейджа ↑/↓). */
export function updateWatchEntry(
  host: string,
  score: number
): { entries: WatchEntry[]; prevScore: number | null } {
  const entries = loadWatchlist();
  const entry = entries.find((item) => item.host === host);
  if (!entry) {
    return { entries, prevScore: null };
  }
  const prevScore = entry.lastScore;
  const next = entries.map((item) =>
    item.host === host
      ? {
          ...item,
          prevScore,
          lastScore: score,
          scannedAt: new Date().toISOString(),
        }
      : item
  );
  persist(next);
  return { entries: next, prevScore };
}

import {
  avatarSeed,
  createFace,
} from "@/components/kokonutui/avatar-picker";

export interface HistoryEntry {
  id: string;
  url: string;
  host: string;
  score: number;
  scannedAt: string;
  standard: string;
  device: string;
  totalViolations: number;
  counts: Record<string, number>;
  avatar: { displayName: string; variant: number };
  face?: ReturnType<typeof createFace>;
}

const KEY = "a11ylens-history";
const MAX_ENTRIES = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    const entries = JSON.parse(raw) as HistoryEntry[];
    return entries.map((entry) => ({
      ...entry,
      face: createFace(
        avatarSeed(entry.avatar.displayName, entry.avatar.variant)
      ),
    }));
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }
  // Лицо вычисляется на клиенте из seed — в хранилище идёт только seed.
  const slim = entries
    .slice(0, MAX_ENTRIES)
    .map(({ face: _face, ...rest }) => rest);
  window.localStorage.setItem(KEY, JSON.stringify(slim));
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const withFace = {
    ...entry,
    face: createFace(
      avatarSeed(entry.avatar.displayName, entry.avatar.variant)
    ),
  };
  const next = [
    withFace,
    ...loadHistory().filter((item) => item.id !== entry.id),
  ];
  persist(next);
  return next;
}

export function removeHistory(id: string): HistoryEntry[] {
  const next = loadHistory().filter((item) => item.id !== id);
  persist(next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  persist([]);
  return [];
}

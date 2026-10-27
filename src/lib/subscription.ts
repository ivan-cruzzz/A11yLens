export type PlanId = "free" | "pro" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  priceRub: number;
  /** null — безлимит. */
  scansPerDay: number | null;
  bulk: boolean;
  pdf: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceRub: 0,
    scansPerDay: 5,
    bulk: false,
    pdf: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceRub: 990,
    scansPerDay: 100,
    bulk: true,
    pdf: true,
  },
  business: {
    id: "business",
    name: "Business",
    priceRub: 2990,
    scansPerDay: null,
    bulk: true,
    pdf: true,
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "business"];

const PLAN_KEY = "a11ylens:plan:v1";
const USAGE_KEY = "a11ylens:usage:v1";

export interface Usage {
  /** Локальная дата YYYY-MM-DD. */
  date: string;
  count: number;
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isPlanId(value: unknown): value is PlanId {
  return value === "free" || value === "pro" || value === "business";
}

export function getPlan(): Plan {
  if (typeof window === "undefined") {
    return PLANS.free;
  }
  try {
    const raw = window.localStorage.getItem(PLAN_KEY);
    const id: unknown = raw ? JSON.parse(raw) : null;
    return isPlanId(id) ? PLANS[id] : PLANS.free;
  } catch {
    return PLANS.free;
  }
}

export function setPlan(id: PlanId): Plan {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify(id));
    } catch {
      // Хранилище недоступно — план живёт до перезагрузки.
    }
  }
  return PLANS[id];
}

/** Счётчик проверок за сегодня; при смене дня — ноль без записи. */
export function getUsageToday(): Usage {
  if (typeof window === "undefined") {
    return { date: today(), count: 0 };
  }
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (raw) {
      const usage = JSON.parse(raw) as Usage;
      if (usage.date === today()) {
        return usage;
      }
    }
  } catch {
    // Битые данные — считаем день пустым.
  }
  return { date: today(), count: 0 };
}

export function recordScan(): void {
  if (typeof window === "undefined") {
    return;
  }
  const next: Usage = { date: today(), count: getUsageToday().count + 1 };
  try {
    window.localStorage.setItem(USAGE_KEY, JSON.stringify(next));
  } catch {
    // Не критично: лимит просто не уменьшится.
  }
}

export function canScan(): boolean {
  const limit = getPlan().scansPerDay;
  return limit === null || getUsageToday().count < limit;
}

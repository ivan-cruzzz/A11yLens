import type { NativeScanMode } from "./report-types";

/** Идентификатор режима интенсивности — совпадает со значением CLI --mode. */
export type ModeId = NativeScanMode;

export interface ModeConfig {
  id: ModeId;
  /** Русская подпись для переключателя. */
  label: string;
  /** Что режим меняет — по-человечески. */
  description: string;
  /** Значение флага CLI --mode (один конфиг с движком). */
  mode: NativeScanMode;
  /** Сколько страниц сканировать: --max-pages. */
  maxPages: number;
  /** Общий лимит времени на скан: --timeout, мс. */
  timeoutMs: number;
  /** Темп тикера этапов в UI — быстрее режим, быстрее тикер. */
  stageMs: number;
}

/**
 * Единый конфиг режимов «быстро / обычно / глубоко» (R04.2): десктоп не
 * придумывает свои таймауты, а один раз переводит выбор пользователя в
 * флаги CLI-движка. Режимы меняют паузы/таймауты/лимиты, не набор векторов.
 */
export const MODES: Record<ModeId, ModeConfig> = {
  quick: {
    id: "quick",
    label: "Быстро",
    description: "2 страницы, короткие таймауты — беглая проверка",
    mode: "quick",
    maxPages: 2,
    timeoutMs: 45_000,
    stageMs: 1_600,
  },
  normal: {
    id: "normal",
    label: "Обычно",
    description: "4 страницы, стандартные лимиты — повседневный режим",
    mode: "normal",
    maxPages: 4,
    timeoutMs: 90_000,
    stageMs: 2_600,
  },
  deep: {
    id: "deep",
    label: "Глубоко",
    description: "8 страниц, долгие таймауты — тщательный аудит",
    mode: "deep",
    maxPages: 8,
    timeoutMs: 180_000,
    stageMs: 4_000,
  },
};

export const MODE_ORDER: readonly ModeId[] = ["quick", "normal", "deep"];

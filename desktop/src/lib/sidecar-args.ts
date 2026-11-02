import { MODES, type ModeId } from "./modes";

export interface EngineLaunch {
  url: string;
  modeId: ModeId;
  /**
   * Сколько страниц уже просканировано в прерванной попытке (R04.3):
   * --max-pages получает остаток плана, а не весь план.
   */
  pagesDone?: number;
}

/**
 * Аргументы командной строки sidecar-движка (CLI `a11ylens scan`).
 * Нормализация URL — забота движка; десктоп передаёт адрес как есть.
 */
export function buildEngineArgs(launch: EngineLaunch): string[] {
  const config = MODES[launch.modeId];
  const planned = config.maxPages;
  const pagesLeft = Math.max(1, planned - Math.max(0, launch.pagesDone ?? 0));
  return [
    "scan",
    launch.url,
    "--json",
    "--mode",
    config.mode,
    "--max-pages",
    String(pagesLeft),
    "--timeout",
    String(config.timeoutMs),
  ];
}

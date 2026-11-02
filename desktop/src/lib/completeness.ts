import type { EngineReport } from "./report-types";

export interface Completeness {
  /** Отчёт можно показывать как законченный. */
  complete: boolean;
  /** Сколько страниц фактически просканировано. */
  pagesDone: number;
  /** Сколько запланировано выбранным режимом. */
  pagesPlanned: number;
  /** Сколько страниц осталось — уходит в --max-pages при «Продолжить». */
  remainingPages: number;
  /** Причины пометки «неполный» (для баннера). */
  reasons: string[];
  /** Деградации движка — заметки, не делающие отчёт неполным. */
  notes: string[];
}

export interface AssessInput {
  report: EngineReport | null;
  /** Лимит страниц выбранного режима. */
  plannedPages: number;
  /** Sidecar завершился с ошибкой и не выдал JSON. */
  sidecarFailed: boolean;
}

/**
 * Оценка полноты отчёта (R04.3): обрыв сети на середине не выбрасывает
 * сделанное — попытка помечается «неполной», а «Продолжить» перезапускает
 * sidecar с --max-pages на непросканированные страницы.
 * Деградации (недоступен crt.sh/OSV) — заметки: проверка пропущена,
 * но остальной отчёт полон.
 */
export function assessCompleteness(input: AssessInput): Completeness {
  const { report, plannedPages, sidecarFailed } = input;

  if (!report || !report.scan) {
    return {
      complete: false,
      pagesDone: 0,
      pagesPlanned: plannedPages,
      remainingPages: plannedPages,
      reasons: sidecarFailed
        ? ["Движок не вернул отчёт — скан прервался до результата"]
        : ["Отчёт пуст"],
      notes: [],
    };
  }

  const reasons: string[] = [];
  const notes: string[] = [...(report.native?.degradations ?? [])];

  const pagesDone = Math.max(1, report.scan.pages?.length ?? 1);
  if (pagesDone < plannedPages) {
    reasons.push(
      `Просканировано ${pagesDone} из ${plannedPages} запланированных страниц`
    );
  }

  if (report.scan.security?.error) {
    reasons.push(`Аудит безопасности не выполнен: ${report.scan.security.error}`);
  }

  if (report.native?.error) {
    reasons.push(`Нативные проверки не выполнены: ${report.native.error}`);
  }

  return {
    complete: reasons.length === 0,
    pagesDone,
    pagesPlanned: plannedPages,
    remainingPages: Math.max(0, plannedPages - pagesDone),
    reasons,
    notes,
  };
}

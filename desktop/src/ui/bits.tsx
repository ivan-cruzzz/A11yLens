import type { SecuritySeverity } from "../lib/report-types";
import { SEVERITY_LABELS } from "./labels";

/** Кольцо скора 0–100 — визуальный язык веба (ScoreCounter): монохромная шкала. */
export function ScoreRing({ value, label }: { value: number | null; label: string }) {
  const tone = value === null ? "" : value >= 80 ? "" : value >= 50 ? "mid" : "low";
  const verdict =
    value === null
      ? "нет данных"
      : value >= 80
        ? "хорошая"
        : value >= 50
          ? "требует доработки"
          : "критическая";
  return (
    <div className="widget">
      <span className="widget-title">{label}</span>
      <div className={`score-ring ${tone}`} role="status" aria-label={`${label}: ${value ?? "нет"} из 100`}>
        {value ?? "—"}
      </div>
      <span className="verdict">{verdict}</span>
    </div>
  );
}

export function SeverityChip({ severity }: { severity: SecuritySeverity }) {
  return (
    <span className={`severity ${severity}`}>критичность: {SEVERITY_LABELS[severity]}</span>
  );
}

export const SCAN_PHASES = [
  "Открываем страницу в браузере…",
  "Прогоняем правила axe-core…",
  "Аудируем безопасность…",
  "Нативные проверки: TLS, порты, DNS…",
] as const;

/** Степпер этапов — как ScanStepper веба: линия + шаги. */
export function ProgressStepper({ current }: { current: number }) {
  const progress = Math.min(1, (current + 1) / SCAN_PHASES.length);
  return (
    <div aria-live="polite">
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={SCAN_PHASES.length}
        aria-valuenow={current + 1}
      >
        <div className="progress-fill" style={{ ["--progress" as string]: String(progress) }} />
      </div>
      <ol className="phase-list">
        {SCAN_PHASES.map((phase, index) => (
          <li key={phase} className={index < current ? "done" : index === current ? "active" : ""}>
            <span className="phase-dot">{index < current ? "✓" : index + 1}</span>
            <span>{phase}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

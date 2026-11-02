import { MODES, MODE_ORDER, type ModeId } from "../lib/modes";

/** Панель запуска: URL + режим интенсивности (один конфиг с CLI --mode). */
export default function ScanForm({
  url,
  modeId,
  busy,
  disabled,
  onUrlChange,
  onModeChange,
  onScan,
}: {
  url: string;
  modeId: ModeId;
  busy: boolean;
  disabled: boolean;
  onUrlChange: (url: string) => void;
  onModeChange: (mode: ModeId) => void;
  onScan: () => void;
}) {
  const config = MODES[modeId];
  return (
    <section className="card scan-form" aria-label="Запуск сканирования">
      <h2>Проверить сайт</h2>
      <div className="row">
        <input
          className="url-input"
          type="url"
          inputMode="url"
          placeholder="example.com"
          aria-label="Адрес сайта"
          value={url}
          disabled={busy || disabled}
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !disabled && !busy) {
              onScan();
            }
          }}
        />
        <button
          className="scan-button"
          type="button"
          disabled={busy || disabled || url.trim().length === 0}
          onClick={onScan}
        >
          {busy ? "Сканируем…" : "Сканировать"}
        </button>
      </div>
      <div className="mode-group" role="group" aria-label="Режим интенсивности">
        {MODE_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className="mode-chip"
            aria-pressed={id === modeId}
            disabled={busy || disabled}
            onClick={() => onModeChange(id)}
          >
            <span className="name">{MODES[id].label}</span>
            <span className="desc">{MODES[id].description}</span>
          </button>
        ))}
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Стандарт WCAG AA, десктоп-вьюпорт. Таймаут скана: {Math.round(config.timeoutMs / 1000)} с.
        Проверяйте только свои сайты или с разрешения владельца.
      </p>
    </section>
  );
}

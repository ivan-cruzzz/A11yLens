import { MODE_TITLE_LABELS } from "./labels";
import type { HistoryEntry } from "../lib/history";

/** Локальная история сканов (файл в app data, не localStorage). */
export default function HistoryPanel({
  entries,
  selectedId,
  onOpen,
  onClear,
}: {
  entries: HistoryEntry[];
  selectedId: string | null;
  onOpen: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  return (
    <aside className="card" aria-label="История сканов">
      <h2>
        История{" "}
        <button className="ghost-button" type="button" onClick={onClear} disabled={entries.length === 0}>
          Очистить
        </button>
      </h2>
      {entries.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          Здесь появятся ваши сканы — с скорами и пометкой, если отчёт был неполным.
          История хранится локально, в данных приложения.
        </p>
      ) : (
        <ul className="history-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={`history-item ${entry.id === selectedId ? "selected" : ""}`}
                onClick={() => onOpen(entry)}
              >
                <span className="host">{entry.host}</span>
                <span className="meta">
                  <span>{new Date(entry.scannedAt).toLocaleString("ru-RU")}</span>
                  <span>{MODE_TITLE_LABELS[entry.mode] ?? entry.mode}</span>
                  {!entry.complete ? <span className="incomplete-tag">неполный</span> : null}
                </span>
                <span className="scores">
                  <span>A11y {entry.scores.a11y ?? "—"}</span>
                  <span>Sec {entry.scores.security ?? "—"}</span>
                  <span>Native {entry.scores.native ?? "—"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

import { useState } from "react";
import type { BrowserStatus, AppState } from "../tauri";

/**
 * Первый запуск (R04.1, R04.2): экран этики «только свои сайты или с
 * разрешения» + согласие на докачку Playwright-Chromium. Без обоих
 * согласий скан не запускается — App не показывает форму до accept.
 */
export default function FirstRun({
  browser,
  installing,
  installError,
  onAccept,
  onInstall,
}: {
  browser: BrowserStatus | null;
  installing: boolean;
  installError: string | null;
  onAccept: (consent: { ethics: boolean; chromium: boolean }) => void;
  onInstall: () => void;
}) {
  const [ethics, setEthics] = useState(false);
  const [chromium, setChromium] = useState(false);

  const browserInstalled = browser?.installed === true;
  const canStart = ethics && (browserInstalled || chromium);

  return (
    <div className="overlay">
      <div className="card first-run" role="dialog" aria-modal="true" aria-label="Первый запуск">
        <h2>Прежде чем начать</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          A11yLens ищет слабые места сайтов: нарушения доступности и уязвимые
          настройки. Это диагностика, а не атака: никаких брутфорсов и
          нагрузочных проб, только лёгкие запросы.
        </p>

        <label className="consent">
          <input
            type="checkbox"
            checked={ethics}
            onChange={(event) => setEthics(event.target.checked)}
          />
          <span>
            Я буду проверять <strong>только свои сайты или сайты, на проверку которых у
            меня есть разрешение</strong> владельца.
          </span>
        </label>

        {browserInstalled ? (
          <label className="consent">
            <input
              type="checkbox"
              checked={chromium}
              onChange={(event) => setChromium(event.target.checked)}
            />
            <span>
              Браузер Chromium уже установлен ({browser?.browsersDir}). Докачка не
              потребуется — подтверждаю, что понимаю, откуда сканер берёт браузер.
            </span>
          </label>
        ) : (
          <label className="consent">
            <input
              type="checkbox"
              checked={chromium}
              onChange={(event) => setChromium(event.target.checked)}
            />
            <span>
              Согласен на докачку браузера Playwright-Chromium (~150 МБ) при первом
              скане — без него сканер не открывает страницы. Загрузка идёт с
              официального CDN Playwright один раз.
            </span>
          </label>
        )}

        {!browserInstalled && chromium ? (
          <div className="section-gap">
            <button
              className="ghost-button"
              disabled={installing}
              onClick={onInstall}
              type="button"
            >
              {installing ? "Качаем Chromium…" : "Скачать Chromium сейчас"}
            </button>
            {installError ? <p className="error-text">{installError}</p> : null}
          </div>
        ) : null}

        <button
          className="scan-button start-button"
          disabled={!canStart}
          onClick={() => onAccept({ ethics, chromium })}
          type="button"
        >
          Принимаю — открыть сканер
        </button>
        {!canStart ? (
          <p className="error-text" style={{ margin: 0 }}>
            Без согласия с этими условиями скан не запускается.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type { AppState };

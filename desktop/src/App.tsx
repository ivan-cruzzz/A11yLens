import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, type AppState, type BrowserStatus, type EngineRun } from "./tauri";
import { MODES, type ModeId } from "./lib/modes";
import { buildEngineArgs } from "./lib/sidecar-args";
import { isPlaywrightMissing, parseEngineOutput } from "./lib/engine-json";
import { assessCompleteness, type Completeness } from "./lib/completeness";
import {
  makeHistoryEntry,
  mergeHistory,
  type HistoryEntry,
} from "./lib/history";
import type { EngineReport } from "./lib/report-types";
import FirstRun from "./ui/FirstRun";
import ScanForm from "./ui/ScanForm";
import ReportView from "./ui/ReportView";
import HistoryPanel from "./ui/HistoryPanel";
import { ProgressStepper, SCAN_PHASES } from "./ui/bits";

const DEFAULT_STATE: AppState = {
  ethicsAccepted: false,
  chromiumConsent: false,
  theme: "dark",
};

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [browser, setBrowser] = useState<BrowserStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [modeId, setModeId] = useState<ModeId>("normal");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<EngineReport | null>(null);
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [continueBusy, setContinueBusy] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const lastLaunch = useRef<{ url: string; modeId: ModeId; pagesDone: number } | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Загрузка состояния, истории и статуса браузера ──
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const loaded = await invoke<AppState | null>("load_state");
        const list = await invoke<HistoryEntry[]>("load_history");
        const status = await invoke<BrowserStatus>("check_browser");
        if (cancelled) return;
        setState(loaded ?? DEFAULT_STATE);
        setHistory(list);
        setBrowser(status);
      } catch (loadError) {
        if (cancelled) return;
        // Окно вне Tauri (просто открыт dist/index.html): даём посмотреть UI,
        // first-run останется — согласия нет, скан не запустится.
        setState(DEFAULT_STATE);
        setBrowser({ installed: false, browsersDir: "" });
        setError(
          loadError instanceof Error ? loadError.message : String(loadError)
        );
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Тема ──
  useEffect(() => {
    document.documentElement.classList.toggle("dark", state?.theme !== "light");
  }, [state?.theme]);

  const persistState = useCallback((next: AppState) => {
    setState(next);
    void invoke("save_state", { state: next }).catch(() => undefined);
  }, []);

  const startTicker = useCallback(
    (mode: ModeId) => {
      stopTicker();
      setPhase(0);
      ticker.current = setInterval(() => {
        setPhase((p) => Math.min(p + 1, SCAN_PHASES.length - 1));
      }, MODES[mode].stageMs);
    },
    []
  );

  const stopTicker = () => {
    if (ticker.current) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
  };

  useEffect(() => stopTicker, []);

  const persistHistory = useCallback((list: HistoryEntry[]) => {
    setHistory(list);
    void invoke("save_history", { list }).catch(() => undefined);
  }, []);

  /** Запуск sidecar: сборка аргументов → процесс → разбор JSON → история. */
  const runScan = useCallback(
    async (launchUrl: string, launchMode: ModeId, pagesDone: number) => {
      const plannedPages = MODES[launchMode].maxPages;
      setBusy(true);
      setError(null);
      setReport(null);
      setCompleteness(null);
      setSelectedId(null);
      startTicker(launchMode);
      try {
        const args = buildEngineArgs({
          url: launchUrl.trim(),
          modeId: launchMode,
          pagesDone,
        });
        const run = await invoke<EngineRun>("run_engine", { args });
        const parsed = parseEngineOutput(run.stdout);
        const assessed = assessCompleteness({
          report: parsed,
          plannedPages,
          sidecarFailed: parsed === null,
        });
        lastLaunch.current = { url: launchUrl.trim(), modeId: launchMode, pagesDone: assessed.pagesDone };

        if (parsed === null) {
          if (isPlaywrightMissing(run.stderr)) {
            setError(
              "Браузер Chromium не найден. Вернитесь к первому запуску или установите его: npx playwright install chromium"
            );
          } else {
            setError(
              run.stderr.trim() ||
                `Движок завершился с кодом ${run.exitCode}, отчёта нет. Проверьте адрес и подключение.`
            );
          }
        }

        setReport(parsed);
        setCompleteness(assessed);

        const entry = makeHistoryEntry({
          id: crypto.randomUUID(),
          url: launchUrl.trim(),
          mode: launchMode,
          report: parsed,
          complete: assessed.complete,
          pagesDone: assessed.pagesDone,
          pagesPlanned: plannedPages,
        });
        persistHistory(mergeHistory(history, entry));
        setSelectedId(entry.id);
      } catch (scanError) {
        setError(scanError instanceof Error ? scanError.message : String(scanError));
      } finally {
        stopTicker();
        setBusy(false);
      }
    },
    [history, persistHistory, startTicker]
  );

  /** Продолжение прерванного скана: sidecar перезапускается на остаток страниц. */
  const continueScan = useCallback(async () => {
    const launch = lastLaunch.current;
    if (!launch || continueBusy) return;
    setContinueBusy(true);
    try {
      await runScan(launch.url, launch.modeId, launch.pagesDone);
    } finally {
      setContinueBusy(false);
    }
  }, [continueBusy, runScan]);

  const installBrowser = useCallback(async () => {
    setInstalling(true);
    setInstallError(null);
    try {
      await invoke("install_browser");
      // Даём файлам доунлоадиться/распаковаться до статуса.
      const status = await invoke<BrowserStatus>("check_browser");
      setBrowser(status);
      if (!status.installed) {
        setInstallError("Установка ещё не завершилась — повторите проверку через минуту.");
      }
    } catch (installFailure) {
      setInstallError(installFailure instanceof Error ? installFailure.message : String(installFailure));
    } finally {
      setInstalling(false);
    }
  }, []);

  if (!state) {
    return null;
  }

  const showFirstRun = !state.ethicsAccepted || !state.chromiumConsent;
  const scanningDisabled = showFirstRun || (browser !== null && !browser.installed);

  return (
    <>
      {showFirstRun ? (
        <FirstRun
          browser={browser}
          installing={installing}
          installError={installError}
          onAccept={(consent) =>
            persistState({
              ethicsAccepted: consent.ethics,
              chromiumConsent: consent.chromium,
              theme: state.theme,
            })
          }
          onInstall={() => void installBrowser()}
        />
      ) : null}

      <div className="app">
        <header className="app-header">
          <h1>A11yLens</h1>
          <span className="sub">Desktop · Windows</span>
          <span className="spacer" />
          <button
            className="theme-toggle"
            type="button"
            aria-pressed={state.theme === "light"}
            onClick={() =>
              persistState({ ...state, theme: state.theme === "dark" ? "light" : "dark" })
            }
          >
            {state.theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          </button>
        </header>

        <div className="column">
          <ScanForm
            url={url}
            modeId={modeId}
            busy={busy || continueBusy}
            disabled={scanningDisabled}
            onUrlChange={setUrl}
            onModeChange={setModeId}
            onScan={() => void runScan(url, modeId, 0)}
          />

          {browser !== null && !browser.installed ? (
            <div className="card section-gap">
              <h2>Нужен браузер для сканирования</h2>
              <p className="hint" style={{ margin: 0 }}>
                Playwright-Chromium ещё не скачан. Он нужен, чтобы открывать
                страницы и прогонять правила axe.
              </p>
              <button className="ghost-button" type="button" disabled={installing} onClick={() => void installBrowser()}>
                {installing ? "Качаем Chromium…" : "Скачать Chromium (~150 МБ)"}
              </button>
              {installError ? <p className="error-text">{installError}</p> : null}
            </div>
          ) : null}

          {busy || continueBusy ? (
            <section className="card" aria-label="Прогресс сканирования">
              <ProgressStepper current={phase} />
            </section>
          ) : null}

          {error ? (
            <div className="incomplete-banner" role="alert">
              <span className="mark">ошибка</span>
              <p style={{ margin: 0, flex: "1 1 240px" }}>{error}</p>
            </div>
          ) : null}

          {report && completeness ? (
            <ReportView
              report={report}
              completeness={completeness}
              onContinue={() => void continueScan()}
              continueBusy={continueBusy}
            />
          ) : null}

          {!report && !busy && !continueBusy && !error ? (
            <section className="card">
              <h2>Что умеет десктоп-версия</h2>
              <p className="hint" style={{ margin: 0 }}>
                Доступность (axe-core), браузерный аудит безопасности и нативные
                проверки — TLS, топ-100 портов, поддомены через crt.sh, CVE
                библиотек через OSV, SPF/DKIM/DMARC. Движок — тот же, что в CLI:
                sidecar-бинарник, окно не блокируется во время скана.
              </p>
            </section>
          ) : null}
        </div>

        <HistoryPanel
          entries={history}
          selectedId={selectedId}
          onOpen={(entry) => {
            setSelectedId(entry.id);
            setUrl(entry.url);
            setModeId(entry.mode);
            lastLaunch.current = {
              url: entry.url,
              modeId: entry.mode,
              pagesDone: entry.pagesDone,
            };
            if (entry.report) {
              setReport({ scan: entry.report, native: null });
              setCompleteness({
                complete: entry.complete,
                pagesDone: entry.pagesDone,
                pagesPlanned: entry.pagesPlanned,
                remainingPages: Math.max(0, entry.pagesPlanned - entry.pagesDone),
                reasons: entry.complete ? [] : ["Отчёт из истории был сохранён неполным"],
                notes: [],
              });
              setError(null);
            } else {
              setReport(null);
              setCompleteness(null);
              setError("У этой попытки отчёта нет — скан прервался. Запустите продолжение или новый скан.");
            }
          }}
          onClear={() => persistHistory([])}
        />
      </div>
    </>
  );
}

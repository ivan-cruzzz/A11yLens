"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import Link from "next/link";
import {
  CameraIcon,
  ContrastIcon,
  CreditCardIcon,
  EyeIcon,
  FileDownIcon,
  HistoryIcon,
  ImageOffIcon,
  KeyboardIcon,
  ListChecksIcon,
  LockIcon,
  ScanEyeIcon,
  ShieldIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import AIModelSelector from "@/components/kokonutui/ai-model-selector";
import HoldButton from "@/components/kokonutui/hold-button";
import LightboxGrid from "@/components/kokonutui/lightbox-grid";
import Loader from "@/components/kokonutui/loader";
import ParticleButton from "@/components/kokonutui/particle-button";
import ProfileDropdown from "@/components/kokonutui/profile-dropdown";
import ScrollIndex from "@/components/kokonutui/scroll-index";
import SlideToConfirm from "@/components/kokonutui/slide-to-confirm";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import WidgetGrid, {
  type WidgetGridItem,
} from "@/components/kokonutui/bento-grid";
import { FaceArt } from "@/components/kokonutui/avatar-picker";
import BulkUpload from "@/components/app/bulk-upload";
import ScoreCounter from "@/components/app/score-counter";
import ViolationRow from "@/components/app/violation-row";
import { exportReportPdf } from "@/lib/pdf";
import { ENGINE_OPTIONS, type EngineId } from "@/lib/knowledge";
import {
  clearHistory,
  loadHistory,
  removeHistory,
  saveHistory,
  type HistoryEntry,
} from "@/lib/history";
import {
  loadAccount,
  clearAccount,
  registerPathIfNeeded,
  type Account,
} from "@/lib/account";
import {
  canScan,
  getPlan,
  getUsageToday,
  type Plan,
} from "@/lib/subscription";
import { getReportsByHost } from "@/lib/report-store";
import { type ScanDiff } from "@/lib/scan-diff";
import { submitScan } from "@/lib/scan-submit";
import {
  addToWatchlist,
  loadWatchlist,
  removeFromWatchlist,
  type WatchEntry,
} from "@/lib/watchlist";
import ScanDiffCard from "@/components/app/scan-diff";
import SecurityRow from "@/components/app/security-row";
import CommandPalette, {
  type PaletteAction,
} from "@/components/app/command-palette";
import ScanSkeleton from "@/components/app/scan-skeleton";
import ScanStepper from "@/components/app/scan-stepper";
import OnboardingTour from "@/components/app/onboarding-tour";
import { useToast } from "@/components/app/toast";
import AiChat from "@/components/app/ai-chat";
import AccountStats from "@/components/app/account-stats";
import ScoreSparkline from "@/components/app/score-sparkline";
import { downloadReportCsv, downloadReportJson } from "@/lib/export-file";
import { ThemeToggle, useTheme } from "@/lib/theme";
import LimitModal from "@/components/app/limit-modal";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type Category,
  type Device,
  type ScanResult,
  type Standard,
} from "@/lib/types";
import {
  buildRemediationPlan,
  isCleanReport,
  simulateScores,
} from "@/engine/report";
import { cn } from "@/lib/utils";

const SCAN_PHASES = [
  "Открываем страницу в браузере…",
  "Прогоняем правила axe-core…",
  "Снимаем скриншоты нарушений…",
  "Собираем AI-советы…",
];

const STANDARD_LABELS: { id: Standard; label: string }[] = [
  { id: "AA", label: "WCAG AA" },
  { id: "AAA", label: "WCAG AAA" },
  { id: "508", label: "Section 508" },
];

// Иерархия через яркость foreground — работает в обеих темах (R06).
const CATEGORY_TONE: Record<Category, string> = {
  contrast: "text-foreground/85",
  alt: "text-foreground/75",
  keyboard: "text-foreground/85",
  forms: "text-foreground/75",
  aria: "text-foreground/85",
  other: "text-muted-foreground",
};

function ScanPage() {
  const searchParams = useSearchParams();
  const initialUrl = searchParams.get("url") ?? "";

  const [url, setUrl] = useState(initialUrl);
  const [standard, setStandard] = useState<Standard>("AA");
  const [device, setDevice] = useState<Device>("desktop");
  const [maxPages, setMaxPages] = useState(4);
  const [engine, setEngine] = useState<{ model: EngineId; effort: string }>({
    model: "deep",
    effort: "medium",
  });
  // Симуляция «если исправите»: id нарушений и находок, отмеченных чекбоксом.
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());

  const [scanning, setScanning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [bulk, setBulk] = useState<
    { label: string; score: number | null; error?: string }[]
  >([]);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // Тема: общий стор (localStorage + data-theme на <html>), см. src/lib/theme.
  const { theme, setTheme, cycleTheme } = useTheme();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [plan, setPlanState] = useState<Plan | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [diff, setDiff] = useState<ScanDiff | null>(null);
  const [watching, setWatching] = useState(false);
  const [watchEntries, setWatchEntries] = useState<WatchEntry[]>([]);
  const [watchDelta, setWatchDelta] = useState<number | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);
  const router = useRouter();
  const toast = useToast();

  // Хронологические оценки хоста для спарклайна в истории (старые слева).
  const hostScores = (host: string): number[] =>
    getReportsByHost(host)
      .map((report) => report.score)
      .reverse();

  useEffect(() => {
    setHistory(loadHistory());
    setWatchEntries(loadWatchlist());
    const loaded = loadAccount();
    if (!loaded) {
      // Нет аккаунта — сначала регистрация, потом возврат сюда.
      router.replace(
        registerPathIfNeeded(
          `${window.location.pathname}${window.location.search}`
        )
      );
      return;
    }
    setAccount(loaded);
    setPlanState(getPlan());
  }, [router]);

  const runScan = useCallback(
    async (overrideUrl?: string) => {
    const target = (overrideUrl ?? url).trim();
    if (!target) {
      urlInputRef.current?.focus();
      return;
    }
    if (!canScan()) {
      setLimitOpen(true);
      return;
    }
    setScanning(true);
      setError(null);
      setPhase(0);
      const ticker = window.setInterval(
        () => setPhase((p) => Math.min(p + 1, SCAN_PHASES.length - 1)),
        2600
      );
      try {
        const submission = await submitScan({
          url: target,
          standard,
          device,
          maxPages,
        });
        setResult(submission.result);
        setFixedIds(new Set());
        setDiff(submission.diff);
        setWatching(submission.watching);
        if (submission.watchEntries) {
          setWatchEntries(submission.watchEntries);
        }
        setWatchDelta(submission.watchDelta);
        toast("Скан завершён — отчёт готов");
      } catch (scanError) {
        setResult(null);
        setError(
          scanError instanceof Error
            ? scanError.message
            : "Не удалось просканировать страницу"
        );
      } finally {
        window.clearInterval(ticker);
        setScanning(false);
      }
    },
    [url, standard, device, maxPages]
  );

  // Автозапуск при переходе с лендинга с ?url=
  useEffect(() => {
    if (initialUrl && !autoRan.current) {
      autoRan.current = true;
      void runScan(initialUrl);
    }
  }, [initialUrl, runScan]);

  const scanBulk = useCallback(
    async (target: { url?: string; html?: string; label: string }) => {
      if (!canScan()) {
        setLimitOpen(true);
        return;
      }
      setScanning(true);
      setError(null);
      try {
        const submission = await submitScan({
          url: target.url,
          html: target.html,
          standard,
          device,
          maxPages,
        });
        const scanned = submission.result;
        setResult(scanned);
        setFixedIds(new Set());
        setDiff(submission.diff);
        setWatching(submission.watching);
        if (submission.watchEntries) {
          setWatchEntries(submission.watchEntries);
        }
        setWatchDelta(submission.watchDelta);
        toast("Скан завершён — отчёт готов");
        setUrl(scanned.url === "HTML-файл" ? target.label : scanned.url);
        setBulk((prev) =>
          [
            { label: target.label, score: scanned.score },
            ...prev.filter((row) => row.label !== target.label),
          ].slice(0, 12)
        );
      } catch (bulkError) {
        const message =
          bulkError instanceof Error
            ? bulkError.message
            : "Ошибка сканирования";
        setBulk((prev) =>
          [{ label: target.label, score: null, error: message }, ...prev].slice(
            0,
            12
          )
        );
      } finally {
        setScanning(false);
      }
    },
    [standard, device, maxPages]
  );

  const exportPdf = useCallback(async () => {
    if (!result || pdfBusy) {
      return;
    }
    if (!getPlan().pdf) {
      router.push("/pricing");
      return;
    }
    setPdfBusy(true);
    try {
      await exportReportPdf(result, engine.model);
    } finally {
      setPdfBusy(false);
    }
  }, [result, engine.model, pdfBusy, router]);

  const saveReport = useCallback(
    (avatar: { displayName: string; variant: number }) => {
      if (!result) {
        return;
      }
      const entry: HistoryEntry = {
        id: `${result.url}-${result.scannedAt}`,
        url: result.url,
        host: avatar.displayName || result.host,
        score: result.score,
        scannedAt: result.scannedAt,
        standard: result.standard,
        device: result.device,
        totalViolations: result.totalViolations,
        counts: result.counts,
        avatar,
      };
      setHistory(saveHistory(entry));
    },
    [result]
  );

  const engineModels = useMemo(
    () =>
      ENGINE_OPTIONS.map((option) => ({
        id: option.id,
        name: option.name,
        description: option.description,
        efforts: option.efforts,
        defaultEffort: option.defaultEffort,
      })),
    []
  );

  const tabItems = useMemo(() => {
    if (!result) {
      return [];
    }
    const toggleFixed = (id: string, fixed: boolean) => {
      setFixedIds((prev) => {
        const next = new Set(prev);
        if (fixed) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    };
    const tabs = [
      { id: "all", title: "Все нарушения", icon: ListChecksIcon },
      { id: "contrast", title: "Контрасты", icon: ContrastIcon },
      { id: "alt", title: "Alt-тексты", icon: ImageOffIcon },
      { id: "keyboard", title: "Клавиатура", icon: KeyboardIcon },
      { id: "forms", title: "Формы", icon: ListChecksIcon },
      { id: "aria", title: "ARIA", icon: WandSparklesIcon },
    ];
    const a11yTabs = tabs.map((tab) => {
      const category = tab.id as Category | "all";
      const violations =
        category === "all"
          ? result.violations
          : result.violations.filter((item) => item.category === category);
      return {
        id: tab.id,
        title:
          category === "all"
            ? tab.title
            : `${tab.title} · ${violations.length}`,
        icon: tab.icon,
        content: (
          <div className="grid items-start gap-4 sm:grid-cols-2">
            {violations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground sm:col-span-2">
                Нарушений в этой категории не найдено — так держать!
              </p>
            ) : (
              violations.map((violation, index) => (
                <ViolationRow
                  engine={engine.model}
                  fixed={fixedIds.has(violation.id)}
                  index={index}
                  key={violation.id}
                  onToggleFixed={(value) => toggleFixed(violation.id, value)}
                  violation={violation}
                />
              ))
            )}
          </div>
        ),
      };
    });

    let securityTab: (typeof a11yTabs)[number] | null = null;
    if (result.security) {
      const audit = result.security;
      // Находка без evidence не показывается как сработавшая (R02.1).
      const confirmed = audit.findings.filter((item) => item.evidence);
      const hidden = audit.findings.length - confirmed.length;
      securityTab = {
        id: "security",
        title: `Безопасность · ${
          confirmed.filter((item) => item.severity !== "info").length
        }`,
        icon: ShieldIcon,
        content: (
          <div className="grid items-start gap-4 sm:grid-cols-2">
            {audit.error ? (
              <p
                className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground sm:col-span-2"
                role="alert"
              >
                Аудит безопасности не выполнен: {audit.error}
              </p>
            ) : confirmed.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground sm:col-span-2">
                {audit.findings.length > 0
                  ? `Находки скрыты (${audit.findings.length}): в этом отчёте нет доказательств — формат старой версии. Сделайте новый скан.`
                  : "Проблем безопасности не найдено — отличная защита!"}
              </p>
            ) : (
              confirmed.map((item) => (
                <SecurityRow
                  fixed={fixedIds.has(item.id)}
                  finding={item}
                  key={item.id}
                  onToggleFixed={(value) => toggleFixed(item.id, value)}
                />
              ))
            )}
            {hidden > 0 && !audit.error ? (
              <p className="text-center text-muted-foreground text-xs sm:col-span-2">
                {hidden} находок без доказательств скрыто — они не показаны как
                сработавшие.
              </p>
            ) : null}
          </div>
        ),
      };
    }
    return [...a11yTabs, ...(securityTab ? [securityTab] : [])];
  }, [result, engine.model, fixedIds]);

  const lightboxImages = useMemo(() => {
    if (!result) {
      return [];
    }
    const images: {
      alt: string;
      caption?: string;
      height: number;
      src: string;
      width: number;
    }[] = [];
    const seen = new Set<string>();
    const push = (image: {
      alt: string;
      caption?: string;
      height: number;
      src: string;
      width: number;
    }) => {
      // У двух нарушений бывает один и тот же элемент — не дублируем снимок
      // (иначе у лайтбокса совпадут ключи).
      if (seen.has(image.src)) {
        return;
      }
      seen.add(image.src);
      images.push(image);
    };
    if (result.pageScreenshot) {
      push({
        alt: result.pageScreenshot.alt,
        caption: result.pageScreenshot.caption,
        height: result.pageScreenshot.height,
        src: result.pageScreenshot.src,
        width: result.pageScreenshot.width,
      });
    }
    for (const violation of result.violations) {
      for (const node of violation.nodes) {
        if (node.screenshot) {
          push({
            alt: `${violation.title} — ${node.selector}`,
            caption: `${violation.title} · ${node.selector}`,
            height: node.height ?? 400,
            src: node.screenshot,
            width: node.width ?? 640,
          });
        }
      }
    }
    return images;
  }, [result]);

  const dashboardItems: WidgetGridItem[] = useMemo(() => {
    if (!result) {
      return [];
    }
    const simulation =
      fixedIds.size > 0 ? simulateScores(result, fixedIds) : null;
    const countCard = (category: Category): WidgetGridItem => ({
      id: `count-${category}`,
      title: CATEGORY_LABELS[category],
      defaultSpan: 2,
      render: () => (
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-semibold text-4xl tabular-nums",
              CATEGORY_TONE[category]
            )}
          >
            {result.counts[category]}
          </span>
          <span className="text-muted-foreground text-sm">
            нарушений
            <br />
            категории
          </span>
        </div>
      ),
    });
    return [
      {
        id: "score",
        title: "Счётчик доступности",
        defaultSpan: 2,
        render: () => (
          <div className="flex items-center gap-4">
            <ScoreCounter size="sm" value={result.score} />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{result.host}</p>
              <p className="truncate text-muted-foreground">
                {result.meta.title.slice(0, 42)}
              </p>
              {simulation ? (
                <p
                  aria-live="polite"
                  className="font-semibold tabular-nums text-foreground"
                >
                  Если исправите отмеченное: {simulation.score}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Отмечайте нарушения галочкой — увидите новый скор
                </p>
              )}
            </div>
          </div>
        ),
      },
      ...CATEGORY_ORDER.map(countCard),
      ...(result.security
        ? [
            {
              id: "security",
              title: "Безопасность",
              defaultSpan: 2,
              render: () => (
                <div className="flex items-center gap-4">
                  {result.security!.error ? (
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">Аудит не выполнен</p>
                      <p className="text-muted-foreground">
                        {result.security!.error}
                      </p>
                    </div>
                  ) : (
                    <>
                      <ScoreCounter size="sm" value={result.security!.score} />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">
                          Проверок: {result.security!.checksRun}
                        </p>
                        <p className="text-muted-foreground">
                          Находок:{" "}
                          {
                            result.security!.findings.filter(
                              (item) =>
                                item.severity !== "info" && item.evidence
                            ).length
                          }
                        </p>
                        {simulation &&
                        simulation.securityScore !== null &&
                        simulation.securityScore !== result.security!.score ? (
                          <p
                            aria-live="polite"
                            className="font-semibold tabular-nums text-foreground"
                          >
                            Если исправите: {simulation.securityScore}
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              ),
            },
          ]
        : []),
      {
        id: "meta",
        title: "Сводка",
        defaultSpan: 2,
        render: () => (
          <ul className="space-y-1.5 font-mono text-muted-foreground text-xs leading-relaxed">
            <li>Правил пройдено: {result.meta.passedRules}</li>
            <li>Правил нарушено: {result.totalViolations}</li>
            <li>Элементов с проблемой: {result.totalNodes}</li>
            <li>
              Страниц просканировано: {result.pages?.length ?? 1}
              {maxPages > 1 ? ` (лимит ${maxPages})` : ""}
            </li>
            <li>Время: {(result.meta.loadMs / 1000).toFixed(1)} с</li>
          </ul>
        ),
      },
    ];
  }, [result, fixedIds, maxPages]);

  const showProgress = scanning || Boolean(result) || Boolean(error);

  // План исправления и «чисто»-состояние (R03.1, R03.3).
  const planSteps = useMemo(
    () => (result ? buildRemediationPlan(result) : []),
    [result]
  );
  const clean = result ? isCleanReport(result) : false;

  const paletteActions: PaletteAction[] = useMemo(
    () => [
      {
        id: "scan",
        label: "Проверить сайт",
        icon: "scan",
        run: () => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          urlInputRef.current?.focus();
        },
      },
      {
        id: "pricing",
        label: "Тарифы",
        icon: "wallet",
        run: () => router.push("/pricing"),
      },
      {
        id: "history",
        label: "История проверок",
        icon: "history",
        run: () =>
          document
            .getElementById("history")
            ?.scrollIntoView({ behavior: "smooth" }),
      },
      {
        id: "guide",
        label: "Гайд по WCAG",
        icon: "guide",
        run: () => router.push("/guide"),
      },
      {
        id: "theme",
        label: "Переключить тему",
        icon: "theme",
        run: cycleTheme,
      },
      ...(result
        ? [
            {
              id: "pdf",
              label: "Экспорт PDF",
              icon: "pdf" as const,
              run: () => void exportPdf(),
            },
          ]
        : []),
    ],
    [result, router, exportPdf, cycleTheme]
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            className="flex items-center gap-2 font-semibold tracking-tight"
            href="/"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
              <ScanEyeIcon aria-hidden="true" className="size-5" />
            </span>
            A11yLens
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {account ? (
              <ProfileDropdown
                accounts={[
                  {
                    id: "local",
                    name: account.displayName,
                    email: account.email,
                    plan: getPlan().name,
                  },
                ]}
            items={[
              {
                label: "Новая проверка",
                icon: <ScanEyeIcon className="size-4" />,
                onSelect: () => {
                  setUrl("");
                  urlInputRef.current?.focus();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                },
              },
              {
                label: "Экспорт PDF",
                icon: <FileDownIcon className="size-4" />,
                value: result ? "готов" : "нет отчёта",
                onSelect: () => void exportPdf(),
              },
              {
                label: "История проверок",
                icon: <ListChecksIcon className="size-4" />,
                value: String(history.length),
                onSelect: () => {
                  document
                    .getElementById("history")
                    ?.scrollIntoView({ behavior: "smooth" });
                },
              },
              {
                label: "Управление подпиской",
                icon: <CreditCardIcon className="size-4" />,
                value: getPlan().name,
                onSelect: () => router.push("/pricing"),
              },
              {
                label: "Гайд по WCAG",
                icon: <SparklesIcon className="size-4" />,
                onSelect: () => router.push("/guide"),
              },
            ]}
            onSignOut={() => {
              setAccount(clearAccount());
              toast("Вы вышли из аккаунта");
              // Даём анимации удержания доиграть до конца (Yandex режет
              // анимации при мгновенной навигации), потом уходим.
              window.setTimeout(() => router.push("/"), 550);
            }}
            onThemeChange={setTheme}
            theme={theme}
          />
            ) : null}
          </div>
        </div>
      </header>

      <ScrollIndex
        className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6"
        scroller="window"
        selector="h2"
      >
        <main className="flex-1 py-8">
          {/* Панель запуска */}
          <section className="rounded-2xl border border-border bg-card/50 p-5 sm:p-6">
            <form
              className="flex flex-col gap-3 lg:flex-row lg:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                void runScan();
              }}
            >
              <div className="flex-1">
                <label className="sr-only" htmlFor="scan-url">
                  Адрес страницы
                </label>
                <input
                  autoComplete="url"
                  className="h-12 w-full rounded-xl border border-input bg-background px-4 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30"
                  id="scan-url"
                  inputMode="url"
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com"
                  ref={urlInputRef}
                  type="url"
                  value={url}
                />
              </div>
              <ParticleButton
                className="h-12 rounded-xl px-6 text-sm"
                onClick={() => runScan()}
                pendingLabel="Сканирую…"
                successLabel="Отчёт готов"
                type="button"
              >
                Проверить
              </ParticleButton>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <fieldset className="flex items-center gap-1 rounded-xl border border-border p-1">
                <legend className="sr-only">Стандарт доступности</legend>
                {STANDARD_LABELS.map((option) => (
                  <button
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      standard === option.id
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    key={option.id}
                    onClick={() => setStandard(option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </fieldset>
              <fieldset className="flex items-center gap-1 rounded-xl border border-border p-1">
                <legend className="sr-only">Устройство</legend>
                {(["desktop", "mobile"] as Device[]).map((option) => (
                  <button
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      device === option
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    key={option}
                    onClick={() => setDevice(option)}
                    type="button"
                  >
                    {option === "desktop" ? "Десктоп" : "Мобильный"}
                  </button>
                ))}
              </fieldset>
              <fieldset className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5">
                <legend className="sr-only">Сколько страниц сканировать</legend>
                <span className="text-muted-foreground text-xs">Страниц</span>
                {[1, 2, 3, 4].map((count) => (
                  <button
                    aria-pressed={maxPages === count}
                    className={cn(
                      "rounded-lg px-2 py-0.5 font-mono text-xs font-medium transition-colors",
                      maxPages === count
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    key={count}
                    onClick={() => setMaxPages(count)}
                    type="button"
                  >
                    {count}
                  </button>
                ))}
              </fieldset>
              <div className="ml-auto flex items-center gap-3">
                {result ? (
                  <label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
                    <input
                      checked={watching}
                      className="size-4 accent-[var(--accent)]"
                      onChange={(event) => {
                        const next = event.target.checked;
                        setWatching(next);
                        if (next) {
                          setWatchEntries(addToWatchlist(result.host, result.score));
                          setWatchDelta(null);
                          toast(`${result.host} добавлен в отслеживание`);
                        } else {
                          setWatchEntries(removeFromWatchlist(result.host));
                        }
                      }}
                      type="checkbox"
                    />
                    Следить за сайтом
                  </label>
                ) : null}
                <AIModelSelector
                  models={engineModels}
                  onChange={(next) =>
                    setEngine({
                      model: next.model as EngineId,
                      effort: next.effort,
                    })
                  }
                  value={engine}
                />
              </div>
            </div>

            {watchEntries.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {watchEntries.map((entry) => (
                  <li
                    className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs"
                    key={entry.host}
                  >
                    <span className="font-medium">{entry.host}</span>
                    <span className="font-semibold tabular-nums">
                      {entry.lastScore}
                    </span>
                    {entry.prevScore !== null ? (
                      <span
                        aria-label={
                          entry.lastScore > entry.prevScore
                            ? "Стало лучше"
                            : entry.lastScore < entry.prevScore
                              ? "Стало хуже"
                              : "Без изменений"
                        }
                        className="text-muted-foreground tabular-nums"
                      >
                        {entry.lastScore > entry.prevScore
                          ? "↑"
                          : entry.lastScore < entry.prevScore
                            ? "↓"
                            : "—"}
                        {Math.abs(entry.lastScore - entry.prevScore) || ""}
                      </span>
                    ) : null}
                    <button
                      aria-label={`Убрать ${entry.host} из отслеживания`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() =>
                        setWatchEntries(removeFromWatchlist(entry.host))
                      }
                      type="button"
                    >
                      ×
                    </button>
                  </li>
                ))}
                {watchDelta !== null && watchDelta !== 0 ? (
                  <li className="sr-only" role="status">
                    Изменение с прошлого скана: {watchDelta > 0 ? "+" : ""}
                    {watchDelta}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-dashed border-border px-4 py-3.5 text-muted-foreground text-xs leading-relaxed">
                <EyeIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  Пока никто не под наблюдением. Отсканируйте сайт и включите
                  «Следить за сайтом» — здесь появятся чипы с дельтой скора
                  между сканами.
                </span>
              </p>
            )}
          </section>

          {/* Прогресс: skeleton + степпер */}
          {showProgress && !result ? (
            <section className="mx-auto mt-6 w-full max-w-3xl">
              {scanning ? (
                <>
                  <div className="mx-auto mb-6 max-w-md">
                    <ScanStepper current={phase} phases={SCAN_PHASES} />
                  </div>
                  <ScanSkeleton />
                  <p className="mt-5 text-center text-muted-foreground text-sm" role="status">
                    {SCAN_PHASES[phase]}
                  </p>
                </>
              ) : (
                <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/50 px-4 py-10">
                  <p className="text-center text-muted-foreground text-sm" role="alert">
                    {error ?? "Что-то пошло не так"}
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {/* Ошибка */}
          {error && !scanning ? (
            <p
              className="mt-4 rounded-xl border border-border bg-card/50 p-4 text-foreground"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {/* Отчёт */}
          {result ? (
            <>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  Отчёт: {result.host}
                </h2>
                <SlideToConfirm
                  confirmingLabel="Пересканирую"
                  doneLabel="Готово"
                  label="Потяните, чтобы пересканировать"
                  onConfirm={() => runScan()}
                />
              </div>

              {/* Сравнение с прошлым сканом */}
              <div className="mt-5">
                <ScanDiffCard diff={diff} />
              </div>

              {/* Bento-панель со счётчиком и категориями */}
              <div className="mt-5">
                <WidgetGrid
                  className="@container/wg"
                  defaultLayout={dashboardItems.map((item) => ({
                    id: item.id,
                    span: item.defaultSpan ?? 2,
                  }))}
                  items={dashboardItems}
                  rowHeight={140}
                />
              </div>

              {clean ? (
                /* «Чисто»-состояние: пустой отчёт не бывает просто пустым (R03.3) */
                <div
                  className="mt-8 rounded-2xl border border-border bg-card/50 p-8 text-center"
                  role="status"
                >
                  <p className="font-semibold text-xl">Чисто!</p>
                  <p className="mx-auto mt-2 max-w-xl text-muted-foreground text-sm">
                    Нарушений доступности и подтверждённых проблем безопасности
                    не найдено. Вот что стоит сделать дальше:
                  </p>
                  <ul className="mx-auto mt-5 max-w-xl space-y-2 text-left text-sm">
                    <li className="rounded-xl border border-border px-4 py-3">
                      Отметьте «Следить за сайтом» — при следующих сканах
                      увидите дельту скорa и письма не понадобятся.
                    </li>
                    <li className="rounded-xl border border-border px-4 py-3">
                      Проверьте внутренние страницы: увеличьте лимит «Страниц»
                      в панели запуска и запустите скан снова.
                    </li>
                    <li className="rounded-xl border border-border px-4 py-3">
                      Загляните в{" "}
                      <Link
                        className="underline underline-offset-2 hover:text-foreground"
                        href="/guide"
                      >
                        гайд по WCAG
                      </Link>{" "}
                      — он поможет удержать сайт чистым при следующих правках.
                    </li>
                  </ul>
                </div>
              ) : (
                <>
                  {/* План исправления: действия по убыванию эффекта (R03.1) */}
                  {planSteps.length > 0 ? (
                    <>
                      <motion.h2
                        className="mt-14 text-xl font-semibold tracking-tight sm:mt-16"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                      >
                        План исправления
                      </motion.h2>
                      <p className="mt-1 text-muted-foreground text-sm">
                        Шаги отсортированы по эффекту на скор; усилие оценено
                        по шкале минуты/часы/дни.
                      </p>
                      <ol className="mt-4 space-y-3">
                        {planSteps.map((step, index) => (
                          <li
                            className="rounded-xl border border-border bg-card/60 p-5"
                            key={step.id}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted font-mono text-muted-foreground text-xs">
                                {index + 1}
                              </span>
                              <span className="font-medium text-sm">
                                {step.title}
                              </span>
                              <span className="ml-auto flex flex-wrap gap-1.5">
                                {step.scoreGain > 0 ? (
                                  <span className="rounded-full border border-foreground/40 bg-foreground/10 px-2 py-0.5 font-semibold tabular-nums text-[11px] text-foreground">
                                    +{step.scoreGain} к скору
                                  </span>
                                ) : null}
                                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                                  усилие: {step.effortLabel}
                                </span>
                                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                                  {step.kind === "security"
                                    ? "безопасность"
                                    : "доступность"}
                                </span>
                              </span>
                            </div>
                            <p className="mt-2 text-muted-foreground text-[13px] leading-relaxed">
                              {step.why}
                            </p>
                            <p className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed">
                              <span className="font-medium">Как исправить: </span>
                              {step.recommendation}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : null}

                  {/* Просканированные страницы (R02) */}
                  {result.pages && result.pages.length > 0 ? (
                    <>
                      <h2 className="mt-14 text-xl font-semibold tracking-tight sm:mt-16">
                        Просканированные страницы
                      </h2>
                      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                        {result.pages.map((page) => (
                          <li
                            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3.5 text-sm"
                            key={page.url}
                          >
                            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                              {page.isMain ? "главная" : "внутренняя"}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {page.title}
                            </span>
                            <span className="truncate font-mono text-muted-foreground text-xs">
                              {page.url}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums">
                              нарушений: {page.violations}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {/* Нарушения по вкладкам */}
                  <motion.h2
                    className="mt-14 text-xl font-semibold tracking-tight sm:mt-16"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                  >
                    Нарушения
                  </motion.h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Отмечайте галочкой «исправлено» — скоры выше пересчитаются
                    без пересканирования.
                  </p>
                  <div className="mt-4">
                    <SmoothTab
                      activeColor="bg-accent"
                      activeTextColor="text-accent-foreground"
                      items={tabItems}
                      label="Категории нарушений"
                    />
                  </div>
                </>
              )}

              {/* Скриншоты */}
              {lightboxImages.length > 0 && !clean ? (
                <>
                  <h2 className="mt-14 flex items-center gap-2 text-xl font-semibold tracking-tight sm:mt-16">
                    <CameraIcon
                      aria-hidden="true"
                      className="size-5 text-primary"
                    />
                    Скриншоты нарушений
                  </h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Нажмите на снимок, чтобы открыть лайтбокс с полным
                    изображением.
                  </p>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-border">
                    <LightboxGrid images={lightboxImages} />
                  </div>
                </>
              ) : null}

              {/* Сохранение и экспорт */}
              <h2 className="mt-14 text-xl font-semibold tracking-tight sm:mt-16">
                Сохранить и поделиться
              </h2>
              <div className="mt-4 grid max-w-3xl gap-6 sm:grid-cols-2">
                <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card/50 p-5">
                  <div>
                    <h3 className="font-medium">Сохранить отчёт</h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Иконка берётся из вашего профиля. Задайте название сайта —
                      отчёт появится в истории.
                    </p>
                  </div>
                  <div className="mt-auto space-y-3">
                    <div>
                      <label className="sr-only" htmlFor="save-name">
                        Название сайта
                      </label>
                      <input
                        className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
                        id="save-name"
                        onChange={(event) => setSiteName(event.target.value)}
                        placeholder={result.host}
                        type="text"
                        value={siteName}
                      />
                    </div>
                    <button
                      className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
                      onClick={() => {
                        saveReport({
                          displayName: siteName.trim() || result.host,
                          variant: account?.avatar.variant ?? 0,
                        });
                        toast("Отчёт сохранён в историю");
                      }}
                      type="button"
                    >
                      Сохранить отчёт
                    </button>
                  </div>
                </div>
                <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card/50 p-5">
                  <div>
                    <h3 className="font-medium">Экспорт PDF</h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Полный отчёт: счётчик, нарушения с AI-советами и ссылками
                      на критерии WCAG — в одном файле.
                    </p>
                  </div>
                  <div className="mt-auto">
                    <ParticleButton
                      className="w-full rounded-xl px-5 py-3 text-sm"
                      onClick={() => exportPdf()}
                      pendingLabel="Готовим PDF…"
                      successLabel="Скачано!"
                      type="button"
                    >
                      <FileDownIcon aria-hidden="true" className="size-4" />
                      Скачать PDF-отчёт
                    </ParticleButton>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        className="h-9 rounded-xl border border-border font-medium text-muted-foreground text-xs transition-colors hover:border-foreground/40 hover:text-foreground"
                        onClick={() => {
                          downloadReportJson(result);
                          toast("JSON скачан");
                        }}
                        type="button"
                      >
                        Экспорт JSON
                      </button>
                      <button
                        className="h-9 rounded-xl border border-border font-medium text-muted-foreground text-xs transition-colors hover:border-foreground/40 hover:text-foreground"
                        onClick={() => {
                          downloadReportCsv(result);
                          toast("CSV скачан");
                        }}
                        type="button"
                      >
                        Экспорт CSV
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                      <span className="min-w-0 truncate text-muted-foreground text-xs">
                        Бейдж для README
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={`Бейдж оценки: ${result.score} из 100`}
                          className="h-7"
                          src={`/badge?score=${result.score}&label=${encodeURIComponent(result.host)}`}
                        />
                        <button
                          className="rounded-lg border border-border px-2 py-1 font-medium text-muted-foreground text-[11px] transition-colors hover:text-foreground"
                          onClick={() => {
                            navigator.clipboard
                              ?.writeText(
                                `![Доступность ${result.host}](/badge?score=${result.score}&label=${encodeURIComponent(result.host)})`
                              )
                              .then(() => toast("Markdown-сниппет скопирован"))
                              .catch(() => {
                                // Clipboard недоступен — просто пропускаем.
                              });
                          }}
                          type="button"
                        >
                          Markdown
                        </button>
                      </div>
                    </div>
                    {plan && !plan.pdf ? (
                      <p className="mt-2 text-center text-muted-foreground text-xs">
                        Доступно на тарифе Pro — нажмите, чтобы перейти к
                        тарифам.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* Массовая проверка */}
          <h2
            className="mt-14 flex items-center gap-2 text-xl font-semibold tracking-tight sm:mt-16"
            id="bulk"
          >
            <SparklesIcon aria-hidden="true" className="size-5 text-primary" />
            Массовая проверка
          </h2>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm">
            Загрузите CSV или TXT со списком URL (до 10 адресов на файл) либо
            HTML-файл — просканируем всё подряд и покажем сводные оценки.
          </p>
          <div className="mt-4 max-w-xl">
            {plan && !plan.bulk ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
                <span className="grid size-10 place-items-center rounded-full bg-foreground/10">
                  <LockIcon aria-hidden="true" className="size-5" />
                </span>
                <p className="text-muted-foreground text-sm">
                  Массовая проверка доступна на тарифах Pro и Business.
                </p>
                <Link
                  className="inline-flex h-10 items-center rounded-xl bg-primary px-4 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
                  href="/pricing"
                >
                  Смотреть тарифы
                </Link>
              </div>
            ) : (
              <BulkUpload onScan={scanBulk} />
            )}
          </div>
          {bulk.length > 0 ? (
            <ul className="mt-4 max-w-xl space-y-2">
              {bulk.map((row) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3.5 text-sm"
                  key={row.label}
                >
                  <span className="min-w-0 truncate font-mono text-xs">
                    {row.label}
                  </span>
                  {row.score !== null ? (
                    <span className="font-semibold tabular-nums text-foreground">
                      {row.score}/100
                    </span>
                  ) : (
                    <span className="shrink-0 text-muted-foreground text-xs">
                      {row.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {/* История */}
          <motion.h2
            className="mt-14 text-xl font-semibold tracking-tight sm:mt-16"
            id="history"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
          >
            История проверок
          </motion.h2>
          <AccountStats />
          {history.length === 0 ? (
            <div className="mt-4 max-w-xl rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-foreground/10 text-muted-foreground">
                <HistoryIcon aria-hidden="true" className="size-6" />
              </span>
              <p className="mt-4 font-semibold">История пока пуста</p>
              <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm leading-relaxed">
                Отсканируйте первый сайт и сохраните отчёт — он осядет здесь со
                спарклайном оценок. История хранится только в вашем браузере.
              </p>
              <button
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 font-medium text-accent-foreground text-sm transition-opacity hover:opacity-90"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  urlInputRef.current?.focus();
                }}
                type="button"
              >
                <ScanEyeIcon aria-hidden="true" className="size-4" />
                Проверить первый сайт
              </button>
            </div>
          ) : (
            <>
              <ul className="mt-4 space-y-3">
                {history.map((entry) => (
                  <li
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/60 p-5 transition-colors duration-150 hover:border-foreground/25 hover:bg-card"
                    key={entry.id}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border"
                    >
                      {entry.face ? (
                        <FaceArt className="size-full" face={entry.face} />
                      ) : (
                        <span className="text-muted-foreground">
                          {entry.host.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {entry.host}
                      </span>
                      <span className="block truncate font-mono text-muted-foreground text-xs">
                        {entry.url} ·{" "}
                        {new Date(entry.scannedAt).toLocaleString("ru-RU")} ·
                        WCAG {entry.standard}
                      </span>
                    </span>
                    <ScoreSparkline
                      scores={hostScores(entry.host)}
                      className="hidden sm:block"
                    />
                    <span className="rounded-full bg-foreground/10 px-2.5 py-1 font-semibold tabular-nums text-foreground text-xs">
                      {entry.score}/100
                    </span>
                    <HoldButton
                      className="h-9 min-w-36 text-xs"
                      completeLabel="Удалено"
                      holdDuration={900}
                      holdingLabel="Держите…"
                      onHoldComplete={() => setHistory(removeHistory(entry.id))}
                    >
                      Удалить
                    </HoldButton>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-muted-foreground text-xs">
                Чтобы очистить всю историю разом — удержите «Очистить историю»
                в меню профиля.
              </p>
            </>
          )}
        </main>
      </ScrollIndex>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-8 text-muted-foreground text-xs sm:px-6">
          <span>A11yLens · axe-core · Playwright</span>
          <Link className="transition-colors hover:text-foreground" href="/">
            На главную
          </Link>
        </div>
      </footer>

      <LimitModal
        limit={plan?.scansPerDay ?? 5}
        onClose={() => setLimitOpen(false)}
        open={limitOpen}
        used={getUsageToday().count}
      />

      <CommandPalette actions={paletteActions} />

      <OnboardingTour />

      <AiChat result={result} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center">
          <Loader size="lg" subtitle="Готовим сканер…" title="A11yLens" />
        </div>
      }
    >
      <ScanPage />
    </Suspense>
  );
}

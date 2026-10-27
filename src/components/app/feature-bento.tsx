"use client";

import { useEffect, useState } from "react";
import {
  AccessibilityIcon,
  CameraIcon,
  FileDownIcon,
  KeyboardIcon,
  SparklesIcon,
  ToggleLeftIcon,
} from "lucide-react";
import WidgetGrid, {
  type WidgetGridItem,
} from "@/components/kokonutui/bento-grid";

const ICON = "size-3.5";

function ScoreDemo() {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setValue((current) => (current >= 92 ? 38 : current + 1));
    }, 40);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex items-center gap-4">
      <div
        aria-hidden="true"
        className="grid size-16 place-items-center rounded-full border-4 border-primary/25 border-t-primary font-semibold text-2xl tabular-nums"
      >
        {value}
      </div>
      <p className="text-sm text-muted-foreground">
        Единый индекс 0–100: вес нарушений по критичности минусуется от
        идеала. Анимируется при каждом сканировании.
      </p>
    </div>
  );
}

const CONTRAST_SAMPLES = [
  { fg: "#fafafa", bg: "#0a0a0a", ratio: "19.7:1" },
  { fg: "#a1a1aa", bg: "#0a0a0a", ratio: "9.4:1" },
  { fg: "#71717a", bg: "#18181b", ratio: "3.4:1" },
  { fg: "#d4d4d8", bg: "#27272a", ratio: "10.3:1" },
] as const;

function ContrastSwatches() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CONTRAST_SAMPLES.map((sample) => (
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2 font-mono text-xs"
          key={sample.bg + sample.fg}
          style={{ background: sample.bg, color: sample.fg }}
        >
          <span>Aa</span>
          <span className="opacity-80">{sample.ratio}</span>
        </div>
      ))}
    </div>
  );
}

function Keycaps() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {["Tab", "Shift+Tab", "Enter", "Space", "Esc"].map((key) => (
        <kbd
          className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] text-foreground"
          key={key}
        >
          {key}
        </kbd>
      ))}
    </div>
  );
}

const FEATURE_WIDGETS: WidgetGridItem[] = [
  {
    id: "score",
    title: "Счётчик доступности",
    defaultSpan: 4,
    icon: <AccessibilityIcon className={ICON} />,
    render: (size) => (size === "s" ? null : <ScoreDemo />),
  },
  {
    id: "contrast",
    title: "Контраст по WCAG",
    defaultSpan: 2,
    icon: <ToggleLeftIcon className={ICON} />,
    render: () => <ContrastSwatches />,
  },
  {
    id: "keyboard",
    title: "Клавиатурная навигация",
    defaultSpan: 3,
    icon: <KeyboardIcon className={ICON} />,
    render: () => <Keycaps />,
  },
  {
    id: "ai",
    title: "AI-советы по исправлению",
    defaultSpan: 3,
    icon: <SparklesIcon className={ICON} />,
    render: () => (
      <p className="text-sm text-muted-foreground">
        Три движка разбора: экспресс — одной строкой, глубокий — с рецептами и
        кодом, строгий — с чек-листом и ссылками на критерии WCAG.
      </p>
    ),
  },
  {
    id: "shots",
    title: "Скриншоты нарушений",
    defaultSpan: 3,
    icon: <CameraIcon className={ICON} />,
    render: () => (
      <p className="text-sm text-muted-foreground">
        Playwright фотографирует каждый проблемный элемент — нарушения
        открываются в лайтбоксе один кликом.
      </p>
    ),
  },
  {
    id: "pdf",
    title: "Экспорт PDF",
    defaultSpan: 3,
    icon: <FileDownIcon className={ICON} />,
    render: () => (
      <p className="text-sm text-muted-foreground">
        Отчёт со счётчиком, списком нарушений и советами выгружается в
        аккуратный PDF — готов для клиента или подрядчика.
      </p>
    ),
  },
];

export default function FeatureBento() {
  return (
    <WidgetGrid
      className="@container/wg"
      defaultLayout={FEATURE_WIDGETS.map((widget) => ({
        id: widget.id,
        span: widget.defaultSpan ?? 2,
      }))}
      items={FEATURE_WIDGETS}
      rowHeight={132}
    />
  );
}

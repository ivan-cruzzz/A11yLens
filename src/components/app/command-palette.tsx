"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileDownIcon,
  HistoryIcon,
  MoonIcon,
  ScanEyeIcon,
  SearchIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon: "scan" | "wallet" | "pdf" | "history" | "guide" | "theme";
  run: () => void;
}

const ICONS = {
  scan: ScanEyeIcon,
  wallet: WalletIcon,
  pdf: FileDownIcon,
  history: HistoryIcon,
  guide: SparklesIcon,
  theme: MoonIcon,
} as const;

/** Палитра команд ⌘K/Ctrl+K: фильтр, стрелки, Enter. */
export default function CommandPalette({
  actions,
}: {
  actions: PaletteAction[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const timer = window.setTimeout(
        () => inputRef.current?.focus({ preventScroll: true }),
        40
      );
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? actions.filter((action) => action.label.toLowerCase().includes(q))
      : actions;
  }, [actions, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelectorAll("[data-palette-item]")
      [activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const execute = (index: number) => {
    const action = filtered[index];
    if (!action) {
      return;
    }
    setOpen(false);
    action.run();
  };

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[120] bg-black/70 p-4 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          role="presentation"
          transition={{ duration: 0.18 }}
        >
          <motion.div
            animate={
              reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
            }
            aria-modal="true"
            className="mx-auto mt-[12vh] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -8 }
            }
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }
            }
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="flex items-center gap-2.5 border-border border-b px-4">
              <SearchIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <input
                aria-label="Поиск команды"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) =>
                      Math.min(index + 1, filtered.length - 1)
                    );
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(index - 1, 0));
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    execute(activeIndex);
                  }
                }}
                placeholder="Команда…"
                ref={inputRef}
                type="text"
                value={query}
              />
              <kbd className="rounded-md border border-border px-1.5 py-0.5 font-mono text-muted-foreground text-[10px]">
                ESC
              </kbd>
            </div>

            <div className="max-h-72 overflow-y-auto p-2" ref={listRef}>
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-muted-foreground text-sm">
                  Ничего не найдено
                </p>
              ) : (
                filtered.map((action, index) => {
                  const Icon = ICONS[action.icon];
                  return (
                    <button
                      aria-selected={index === activeIndex}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        index === activeIndex
                          ? "bg-foreground/10 text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      data-palette-item=""
                      key={action.id}
                      onClick={() => execute(index)}
                      onPointerEnter={() => setActiveIndex(index)}
                      role="option"
                      tabIndex={-1}
                      type="button"
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{action.label}</span>
                      {action.hint ? (
                        <span className="shrink-0 text-muted-foreground text-[11px]">
                          {action.hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronUpIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrderItem {
  id: string;
  name: string;
  detail?: string;
}

/**
 * Детали нарушения: простое окно по центру с плавным появлением
 * (fade + лёгкий масштаб) вместо выдвижной панели.
 */
export default function ViolationModal({
  title,
  description,
  impactLabel,
  items = [],
  advice = null,
  confirmLabel = "Понятно",
  children,
}: {
  title: string;
  description?: string;
  impactLabel?: string;
  items?: OrderItem[];
  advice?: { short: string; full: string } | null;
  confirmLabel?: string;
  /** Триггер: клик открывает окно. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(
      () => panelRef.current?.focus({ preventScroll: true }),
      50
    );
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setExpanded(false);
  };

  const panel = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          role="presentation"
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <motion.div
            aria-modal="true"
            className="my-auto w-full max-w-lg rounded-2xl border border-border bg-card p-5 outline-none sm:p-6"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }
            }
            animate={
              reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }
            }
            onClick={(event) => event.stopPropagation()}
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-semibold text-lg leading-snug tracking-tight">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-1 text-muted-foreground text-xs">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                aria-label="Закрыть"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                onClick={close}
                type="button"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            </div>

            <button
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
              onClick={close}
              type="button"
            >
              {confirmLabel}
            </button>
            <button
              className="mt-1 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded ? "Свернуть" : "Детали нарушения"}
              <ChevronUpIcon
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-transform duration-300 motion-reduce:transition-none",
                  expanded && "rotate-180"
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.div
                  animate={
                    reduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, height: "auto" }
                  }
                  exit={
                    reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }
                  }
                  initial={
                    reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }
                  }
                  className="overflow-hidden"
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="mt-2 border-border border-t pt-4">
                    <ul className="space-y-3">
                      {items.map((item, index) => (
                        <li className="flex items-center gap-3" key={item.id}>
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background font-medium text-muted-foreground text-sm">
                            {item.name.charAt(0)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-sm">
                              {item.name}
                            </p>
                            {item.detail ? (
                              <p className="truncate text-muted-foreground text-[13px]">
                                {item.detail}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-muted-foreground text-sm tabular-nums">
                            #{index + 1}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {advice ? (
                      <div className="mt-5">
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              { id: false, label: "Кратко" },
                              { id: true, label: "Подробно" },
                            ] as const
                          ).map((option) => (
                            <button
                              className={cn(
                                "rounded-xl border px-3 py-2 font-medium text-sm transition-colors",
                                verbose === option.id
                                  ? "border-foreground/50 bg-foreground/5"
                                  : "border-border text-muted-foreground hover:border-foreground/30"
                              )}
                              key={option.label}
                              onClick={() => setVerbose(option.id)}
                              type="button"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 rounded-xl border border-border bg-background px-3 py-3">
                          <p className="font-medium text-[13px]">
                            AI-совет по исправлению
                          </p>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                            {verbose ? advice.full : advice.short}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-5 flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
                      <span className="text-muted-foreground">
                        Элементов с проблемой
                      </span>
                      <span className="font-medium tabular-nums">
                        {items.length}
                        {impactLabel ? ` · ${impactLabel}` : ""}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      <span className="cursor-pointer outline-none" onClick={() => setOpen(true)}>
        {children}
      </span>
      {/* Портал в body: иначе fixed-слой позиционируется относительно
          трансформированных предков (вкладки) и уезжает за экран. */}
      {typeof document === "undefined" ? null : createPortal(panel, document.body)}
    </>
  );
}

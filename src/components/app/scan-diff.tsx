"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PlusIcon } from "lucide-react";
import type { ScanDiff } from "@/lib/scan-diff";

/** Карточка «Что изменилось» над бенто: дельта балла + исправлено/появилось. */
export default function ScanDiffCard({ diff }: { diff: ScanDiff | null }) {
  const [delta, setDelta] = useState(0);
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    if (!diff) {
      return;
    }
    if (reduceMotion) {
      setDelta(diff.deltaScore);
      return;
    }
    const controls = animate(0, diff.deltaScore, {
      duration: 0.9,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (latest) => setDelta(Math.round(latest)),
    });
    return () => controls.stop();
  }, [diff, reduceMotion]);

  return (
    <AnimatePresence>
      {diff ? (
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          aria-label="Сравнение с прошлым сканированием"
          className="w-full rounded-2xl border border-border bg-card/50 p-5"
          exit={{ opacity: 0, y: -8 }}
          initial={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-full border-4 border-border/60 font-semibold text-lg tabular-nums"
              role="status"
            >
              {diff.deltaScore > 0
                ? `+${delta}`
                : diff.deltaScore === 0
                  ? "0"
                  : `−${Math.abs(delta)}`}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">Сравнение с прошлым сканом</h3>
              <p className="mt-0.5 text-muted-foreground text-sm">
                Было {diff.previousScore} → стало {diff.currentScore}.{" "}
                {diff.deltaScore === 0
                  ? "Оценка не изменилась."
                  : diff.deltaScore > 0
                    ? "Стало лучше."
                    : "Стало хуже."}
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                <ArrowDownIcon
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                Исправлено: {diff.fixed.length}
              </span>
              <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                <PlusIcon
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                Появилось: {diff.appeared.length}
              </span>
            </div>
          </div>

          {diff.fixed.length + diff.appeared.length > 0 ? (
            <div className="mt-4 grid gap-3 border-border border-t pt-4 sm:grid-cols-2">
              {(
                [
                  { title: "Исправлено", items: diff.fixed },
                  { title: "Появилось", items: diff.appeared },
                ] as const
              ).map((group) =>
                group.items.length > 0 ? (
                  <div key={group.title}>
                    <p className="mb-1.5 flex items-center gap-1.5 font-medium text-[13px]">
                      {group.title === "Исправлено" ? (
                        <CheckIcon aria-hidden="true" className="size-3.5" />
                      ) : null}
                      {group.title}
                    </p>
                    <ul className="space-y-1">
                      {group.items.slice(0, 4).map((item) => (
                        <li
                          className="truncate text-muted-foreground text-xs"
                          key={item.id}
                          title={item.title}
                        >
                          {item.title}
                        </li>
                      ))}
                      {group.items.length > 4 ? (
                        <li className="text-muted-foreground text-xs">
                          и ещё {group.items.length - 4}…
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null
              )}
            </div>
          ) : null}
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import ScoreSparkline from "@/components/app/score-sparkline";
import { cn } from "@/lib/utils";

const DEMO_SCORES = [58, 64, 61, 72, 76, 74, 81];

const DEMO_VIOLATIONS = [
  { title: "Контраст текста ниже 4.5:1", impact: "серьёзная", fixed: true },
  { title: "Кнопка без доступного имени", impact: "серьёзная", fixed: false },
  { title: "Фокус не виден на тёмном фоне", impact: "средняя", fixed: false },
];

/** Живое мини-демо отчёта на лендинге: счётчик, спарклайн, нарушения. */
export default function LiveDemo() {
  const [score, setScore] = useState(DEMO_SCORES[0]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setScore((current) =>
        current >= DEMO_SCORES.at(-1)! ? DEMO_SCORES[0] : current + 1
      );
    }, 50);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      viewport={{ once: true, margin: "-80px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Так выглядит отчёт
      </h2>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Живой пример: счётчик, динамика и найденные нарушения. Свои сайты
        проверяйте в сканере.
      </p>

      <div className="mt-8 grid max-w-3xl gap-4 md:grid-cols-5">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/50 p-6 md:col-span-2">
          <div
            aria-hidden="true"
            className="grid size-24 place-items-center rounded-full border-4 border-foreground/40 border-t-foreground font-semibold text-3xl tabular-nums"
          >
            {score}
          </div>
          <div className="flex flex-col items-center gap-1">
            <ScoreSparkline className="text-foreground" scores={DEMO_SCORES} />
            <span className="text-muted-foreground text-xs">
              динамика за 7 сканов
            </span>
          </div>
        </div>

        <ul className="space-y-2 md:col-span-3">
          {DEMO_VIOLATIONS.map((violation, index) => (
            <motion.li
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 12 }}
              key={violation.title}
              transition={{
                duration: 0.4,
                delay: 0.15 + index * 0.08,
                ease: [0.23, 1, 0.32, 1],
              }}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
                violation.fixed
                  ? "border-border bg-background opacity-60"
                  : "border-border bg-card/50"
              )}
            >
              <span
                className={cn(
                  "text-sm",
                  violation.fixed && "text-muted-foreground line-through"
                )}
              >
                {violation.title}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                  violation.fixed
                    ? "bg-foreground/10 text-muted-foreground"
                    : "border border-border text-muted-foreground"
                )}
              >
                {violation.fixed ? "исправлено" : violation.impact}
              </span>
            </motion.li>
          ))}
          <li className="pt-1">
            <Link
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
              href="/scan"
            >
              Попробовать со своим сайтом
            </Link>
          </li>
        </ul>
      </div>
    </motion.div>
  );
}

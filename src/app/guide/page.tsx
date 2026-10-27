"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ScanEyeIcon } from "lucide-react";
import { GUIDE_SECTIONS } from "@/lib/guide";
import { cn } from "@/lib/utils";

const PROGRESS_KEY = "a11ylens:guide-progress:v1";

function loadProgress(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function GuidePage() {
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    setDone(loadProgress());
  }, []);

  const total = useMemo(
    () => GUIDE_SECTIONS.reduce((sum, section) => sum + section.rules.length, 0),
    []
  );
  const percent = Math.round((done.length / total) * 100);

  const toggle = (id: string) => {
    const next = done.includes(id)
      ? done.filter((item) => item !== id)
      : [...done, id];
    setDone(next);
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    } catch {
      // Хранилище недоступно — прогресс только на сессию.
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border/60 border-b">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            className="flex items-center gap-2 font-semibold tracking-tight"
            href="/"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <ScanEyeIcon aria-hidden="true" className="size-5" />
            </span>
            A11yLens
          </Link>
          <Link
            className="rounded-lg px-3 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/scan"
          >
            К сканеру
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        >
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Гайд по WCAG 2.2
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Ключевые правила доступности по четырём принципам. Отмечайте то,
            что проверили — прогресс сохраняется в браузере.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/15">
              <motion.div
                animate={{ scaleX: percent / 100 }}
                className="h-full origin-left rounded-full bg-foreground"
                initial={{ scaleX: 0 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              />
            </div>
            <span
              aria-label={`Пройдено ${percent} процентов`}
              className="font-medium text-sm tabular-nums"
            >
              {percent}%
            </span>
          </div>
        </motion.div>

        <div className="mt-10 space-y-10">
          {GUIDE_SECTIONS.map((section, sectionIndex) => (
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              key={section.principle}
              transition={{
                duration: 0.45,
                delay: sectionIndex * 0.06,
                ease: [0.23, 1, 0.32, 1],
              }}
              viewport={{ once: true, margin: "-60px" }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <h2 className="font-semibold text-lg">{section.principle}</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                {section.description}
              </p>
              <ul className="mt-4 space-y-2">
                {section.rules.map((rule) => {
                  const checked = done.includes(rule.id);
                  return (
                    <li key={rule.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                          checked
                            ? "border-foreground/40 bg-foreground/5"
                            : "border-border hover:border-foreground/25"
                        )}
                      >
                        <input
                          checked={checked}
                          className="mt-0.5 size-4 shrink-0 accent-[var(--foreground)]"
                          onChange={() => toggle(rule.id)}
                          type="checkbox"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-2">
                            <span
                              className={cn(
                                "font-medium text-sm",
                                checked && "text-muted-foreground line-through"
                              )}
                            >
                              {rule.title}
                            </span>
                            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                              WCAG {rule.wcag}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-muted-foreground text-[13px]">
                            {rule.hint}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          ))}
        </div>
      </main>

      <footer className="border-border/60 border-t py-8">
        <div className="mx-auto max-w-4xl px-4 text-muted-foreground text-xs sm:px-6">
          A11yLens · прогресс чеклиста хранится в вашем браузере
        </div>
      </footer>
    </div>
  );
}

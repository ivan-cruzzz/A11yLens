"use client";

import { motion, useReducedMotion } from "motion/react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Живой степпер процесса скана: 4 шага с прогресс-линией (scaleX). */
export default function ScanStepper({
  phases,
  current,
}: {
  phases: string[];
  current: number;
}) {
  const reduceMotion = useReducedMotion() === true;
  const progress = (current + 1) / phases.length;

  return (
    <div aria-live="polite" className="w-full">
      <div className="relative h-1 overflow-hidden rounded-full bg-foreground/15">
        <motion.div
          animate={{ scaleX: progress }}
          className="h-full origin-left rounded-full bg-foreground"
          initial={{ scaleX: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.6, ease: [0.23, 1, 0.32, 1] }
          }
        />
      </div>
      <ol className="mt-3 grid grid-cols-4 gap-2">
        {phases.map((phase, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              className={cn(
                "flex flex-col items-center gap-1.5 text-center",
                done || active ? "text-foreground" : "text-muted-foreground"
              )}
              key={phase}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full border text-[10px] font-medium tabular-nums transition-colors duration-300",
                  done && "border-foreground bg-foreground text-background",
                  active && "border-foreground/60",
                  !done && !active && "border-border"
                )}
              >
                {done ? (
                  <CheckIcon aria-hidden="true" className="size-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="hidden text-[11px] leading-tight sm:block">
                {phase}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

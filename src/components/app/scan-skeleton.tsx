"use client";

import { motion, useReducedMotion } from "motion/react";

const CARD_SPANS = [
  "col-span-3",
  "col-span-3",
  "col-span-2",
  "col-span-2",
  "col-span-2",
  "col-span-3",
];

/**
 * Скелет бенто-панели на время скана: пульсация opacity плюс лёгкий
 * пробег световой волны (skeleton-shimmer в globals.css). При
 * prefers-reduced-motion остаются статичные заглушки без движения.
 */
export default function ScanSkeleton() {
  const reduceMotion = useReducedMotion() === true;
  return (
    <div aria-hidden="true" className="grid grid-cols-3 gap-4 sm:grid-cols-6">
      {CARD_SPANS.map((span, index) => (
        <motion.div
          animate={reduceMotion ? undefined : { opacity: [0.5, 0.95, 0.5] }}
          className={`h-[140px] rounded-2xl border border-border bg-card/50 skeleton-shimmer ${span}`}
          key={span + index}
          transition={
            reduceMotion
              ? undefined
              : {
                  duration: 1.5,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: index * 0.12,
                }
          }
        />
      ))}
    </div>
  );
}

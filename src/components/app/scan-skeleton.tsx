"use client";

import { motion } from "motion/react";

const CARD_SPANS = [
  "col-span-3",
  "col-span-3",
  "col-span-2",
  "col-span-2",
  "col-span-2",
  "col-span-3",
];

/** Скелет бенто-панели на время скана: пульсация opacity, без сдвигов. */
export default function ScanSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-3 gap-4 sm:grid-cols-6">
      {CARD_SPANS.map((span, index) => (
        <motion.div
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          className={`h-[140px] rounded-2xl border border-border bg-card/50 ${span}`}
          key={span + index}
          transition={{
            duration: 1.5,
            ease: "easeInOut",
            repeat: Infinity,
            delay: index * 0.12,
          }}
        />
      ))}
    </div>
  );
}

"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { XIcon } from "lucide-react";
import { PLANS } from "@/lib/subscription";

/** «Лимит исчерпан»: показывается, когда canScan() = false. */
export default function LimitModal({
  open,
  used,
  limit,
  onClose,
}: {
  open: boolean;
  used: number;
  limit: number;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      onClick={onClose}
      role="presentation"
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
    >
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-lg">Лимит исчерпан</h2>
          <button
            aria-label="Закрыть"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-muted-foreground text-sm">
          Использовано {used} из {limit} проверок сегодня. Тариф «
          {PLANS.pro.name}» снимает лимит до {PLANS.pro.scansPerDay} в день.
        </p>
        <div className="mt-5 grid gap-2">
          <Link
            className="grid h-11 place-items-center rounded-xl bg-primary font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
            href="/pricing"
          >
            Оформить {PLANS.pro.name}
          </Link>
          <button
            className="h-11 rounded-xl border border-border font-medium text-sm transition-colors hover:border-foreground/30"
            onClick={onClose}
            type="button"
          >
            Попробовать завтра
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

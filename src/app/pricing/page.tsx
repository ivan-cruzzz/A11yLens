"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ScanEyeIcon } from "lucide-react";
import PlanCards from "@/components/app/plan-cards";
import CheckoutModal from "@/components/app/checkout-modal";
import { getPlan, PLANS, type PlanId } from "@/lib/subscription";
import { ThemeToggle } from "@/lib/theme";

export default function PricingPage() {
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>("free");
  const [checkoutPlanId, setCheckoutPlanId] = useState<PlanId | null>(null);
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    setCurrentPlanId(getPlan().id);
  }, []);

  const headingMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] as const },
      };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            className="flex items-center gap-2 font-semibold tracking-tight"
            href="/"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
              <ScanEyeIcon aria-hidden="true" className="size-5" />
            </span>
            A11yLens
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              className="rounded-lg px-3 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
              href="/scan"
            >
              К сканеру
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <motion.h1 {...headingMotion} className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Тарифы
        </motion.h1>
        <motion.p
          {...headingMotion}
          className="mt-2 max-w-xl text-muted-foreground"
          transition={
            reduceMotion
              ? undefined
              : {
                  duration: 0.45,
                  delay: 0.06,
                  ease: [0.23, 1, 0.32, 1] as const,
                }
          }
        >
          Демо-режим: оплата не проводится, план активируется сразу и хранится
          в вашем браузере.
        </motion.p>
        <div className="mt-8">
          <PlanCards
            currentPlanId={currentPlanId}
            onCheckout={(id) => setCheckoutPlanId(id)}
          />
        </div>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-6xl px-4 text-muted-foreground text-xs sm:px-6">
          A11yLens · оплата демонстрационная
        </div>
      </footer>

      <CheckoutModal
        onClose={() => setCheckoutPlanId(null)}
        onSuccess={() => setCurrentPlanId(getPlan().id)}
        open={checkoutPlanId !== null}
        plan={checkoutPlanId ? PLANS[checkoutPlanId] : null}
      />
    </div>
  );
}

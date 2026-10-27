"use client";

import { motion, useReducedMotion } from "motion/react";
import { CheckIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/subscription";

/** Три карточки тарифов; Pro выделен рамкой, не цветом. Вход — стаггером. */
export default function PlanCards({
  currentPlanId,
  onCheckout,
}: {
  currentPlanId: PlanId;
  onCheckout: (id: PlanId) => void;
}) {
  const reduceMotion = useReducedMotion() === true;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PLAN_ORDER.map((id, index) => {
        const plan = PLANS[id];
        const current = id === currentPlanId;
        const featured = id === "pro";
        const features = [
          {
            label:
              plan.scansPerDay === null
                ? "Безлимитные проверки"
                : `${plan.scansPerDay} проверок в день`,
            on: true,
          },
          {
            label: "Массовая проверка (до 10 URL)",
            on: plan.bulk,
          },
          { label: "Экспорт в PDF", on: plan.pdf },
          {
            label: "AI-советы по исправлению",
            on: id !== "free",
          },
        ];
        return (
          <motion.div
            animate={
              reduceMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            className={cn(
              "flex flex-col rounded-2xl border bg-card/50 p-6",
              featured ? "border-foreground/40" : "border-border"
            )}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.97, y: 16 }
            }
            key={id}
            transition={{
              duration: 0.45,
              delay: reduceMotion ? 0 : index * 0.08,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{plan.name}</h2>
              {featured ? (
                <span className="rounded-full border border-foreground/40 px-2.5 py-0.5 text-foreground/80 text-xs">
                  Популярный
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {plan.priceRub === 0 ? "0 ₽" : `${plan.priceRub} ₽`}
              <span className="font-normal text-muted-foreground text-sm">
                {" "}
                / мес
              </span>
            </p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {features.map((feature) => (
                <li
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    feature.on ? "text-foreground" : "text-muted-foreground"
                  )}
                  key={feature.label}
                >
                  {feature.on ? (
                    <CheckIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-foreground"
                    />
                  ) : (
                    <MinusIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  {feature.label}
                </li>
              ))}
            </ul>
            <button
              className={cn(
                "mt-6 h-11 rounded-xl font-medium text-sm transition-opacity",
                current
                  ? "cursor-default border border-border text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              )}
              disabled={current}
              onClick={() => onCheckout(id)}
              type="button"
            >
              {current
                ? "Текущий план"
                : id === "free"
                  ? "Перейти на Free"
                  : `Оформить ${plan.name}`}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}

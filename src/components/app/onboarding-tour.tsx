"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface TourStep {
  targetSelector: string;
  title: string;
  text: string;
}

const STEPS: TourStep[] = [
  {
    targetSelector: "#scan-url",
    title: "Введите адрес",
    text: "Сюда вставляйте URL страницы — сканирование запустится кнопкой «Проверить».",
  },
  {
    targetSelector: "#history",
    title: "История и статистика",
    text: "Сохранённые отчёты, динамика оценок и «Моя статистика» живут здесь.",
  },
  {
    targetSelector: "header button[aria-expanded]",
    title: "Профиль и тарифы",
    text: "В меню профиля — подписка, экспорт и тема. Комбинация Ctrl+K открывает палитру команд.",
  },
];

const DONE_KEY = "a11ylens:tour-done:v1";

/** Онбординг-тур: 3 подсказки с затемнением, только на /scan, один раз. */
export default function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || step === null) {
      return;
    }
    const update = () => {
      const element = document.querySelector(STEPS[step].targetSelector);
      setRect(element ? element.getBoundingClientRect() : null);
    };
    update();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mounted]);

  const finish = () => setStep(null);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        if (localStorage.getItem(DONE_KEY)) {
          return;
        }
        localStorage.setItem(DONE_KEY, "1");
        setStep(0);
      } catch {
        // Без localStorage тур не показываем.
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [mounted]);

  if (!mounted || step === null) {
    return null;
  }

  const current = STEPS[step];
  const pad = 10;
  const spotlight = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const cardTop = spotlight
    ? Math.min(
        Math.max(spotlight.top + spotlight.height + 12, 12),
        window.innerHeight - 200
      )
    : window.innerHeight / 2;
  const cardLeft = spotlight
    ? Math.min(Math.max(spotlight.left, 12), window.innerWidth - 322)
    : 24;

  return createPortal(
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[105]"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div
          className="absolute inset-0"
          onClick={finish}
          style={{ background: "rgba(0,0,0,0.65)" }}
        />
        {spotlight ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-xl ring-2 ring-foreground/70"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
            }}
          />
        ) : null}
        <motion.div
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          aria-modal="true"
          className="absolute w-[300px] rounded-2xl border border-border bg-card p-4"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          role="dialog"
          style={{ top: cardTop, left: cardLeft }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <p className="text-muted-foreground text-[11px]">
            Шаг {step + 1} из {STEPS.length}
          </p>
          <h2 className="mt-1 font-semibold text-sm">{current.title}</h2>
          <p className="mt-1.5 text-muted-foreground text-[13px] leading-relaxed">
            {current.text}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <button
              className="text-muted-foreground text-xs transition-colors hover:text-foreground"
              onClick={finish}
              type="button"
            >
              Пропустить
            </button>
            <button
              autoFocus
              className="h-9 rounded-xl bg-primary px-4 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90"
              onClick={() =>
                step < STEPS.length - 1 ? setStep(step + 1) : finish()
              }
              type="button"
            >
              {step < STEPS.length - 1 ? "Далее" : "Готово"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

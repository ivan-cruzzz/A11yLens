"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { CheckIcon, XIcon } from "lucide-react";
import { setPlan, type Plan } from "@/lib/subscription";

type Phase = "form" | "processing" | "done";

const digitsOf = (value: string) => value.replace(/\D/g, "");
const formatCard = (value: string) =>
  digitsOf(value)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
const formatExpiry = (value: string) => {
  const digits = digitsOf(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

/**
 * Демо-оплата: карта никуда не отправляется, план активируется локально.
 */
export default function CheckoutModal({
  plan,
  open,
  onClose,
  onSuccess,
}: {
  plan: Plan | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPhase("form");
    setError(null);
    setCard("");
    setExpiry("");
    setCvc("");
    const timer = setTimeout(() => cardRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "processing") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, phase, onClose]);

  if (!open || !plan) {
    return null;
  }

  const isFree = plan.id === "free";

  const confirm = () => {
    if (!isFree) {
      if (digitsOf(card).length !== 16) {
        setError("Введите 16 цифр номера карты");
        return;
      }
      if (digitsOf(expiry).length !== 4) {
        setError("Укажите срок действия в формате ММ/ГГ");
        return;
      }
      if (digitsOf(cvc).length !== 3) {
        setError("CVC — 3 цифры на обороте карты");
        return;
      }
    }
    setError(null);
    setPhase("processing");
    // Демо: имитация платёжного шлюза, карта никуда не уходит.
    window.setTimeout(() => {
      setPlan(plan.id);
      setPhase("done");
    }, 1200);
  };

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      onClick={() => {
        if (phase !== "processing") {
          onClose();
        }
      }}
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
        {phase === "done" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-foreground/10">
              <CheckIcon aria-hidden="true" className="size-6" />
            </span>
            <h2 className="font-semibold text-lg">Подписка оформлена</h2>
            <p className="text-muted-foreground text-sm">
              Тариф «{plan.name}» активирован. Плата в демо-режиме не
              списывается.
            </p>
            <button
              autoFocus
              className="mt-2 h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
              onClick={() => {
                onSuccess();
                onClose();
              }}
              type="button"
            >
              Отлично
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-lg">
                  {isFree ? "Перейти на Free" : `Оформление «${plan.name}»`}
                </h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  {isFree
                    ? "Лимиты Free (5 проверок в день) станут активны сразу. История и аккаунт сохранятся."
                    : `${plan.priceRub} ₽ в месяц · демо-оплата, деньги не списываются.`}
                </p>
              </div>
              <button
                aria-label="Закрыть"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                disabled={phase === "processing"}
                onClick={onClose}
                type="button"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            </div>

            {!isFree ? (
              <div className="mt-5 space-y-3">
                <div>
                  <label className="sr-only" htmlFor="pay-card">
                    Номер карты
                  </label>
                  <input
                    className="h-11 w-full rounded-xl border border-input bg-background px-3.5 font-mono text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
                    id="pay-card"
                    inputMode="numeric"
                    onChange={(event) => setCard(formatCard(event.target.value))}
                    placeholder="0000 0000 0000 0000"
                    ref={cardRef}
                    type="text"
                    value={card}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="sr-only" htmlFor="pay-expiry">
                      Срок действия
                    </label>
                    <input
                      className="h-11 w-full rounded-xl border border-input bg-background px-3.5 font-mono text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
                      id="pay-expiry"
                      inputMode="numeric"
                      onChange={(event) =>
                        setExpiry(formatExpiry(event.target.value))
                      }
                      placeholder="ММ/ГГ"
                      type="text"
                      value={expiry}
                    />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="pay-cvc">
                      CVC
                    </label>
                    <input
                      className="h-11 w-full rounded-xl border border-input bg-background px-3.5 font-mono text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
                      id="pay-cvc"
                      inputMode="numeric"
                      onChange={(event) =>
                        setCvc(digitsOf(event.target.value).slice(0, 3))
                      }
                      placeholder="CVC"
                      type="password"
                      value={cvc}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <p
                className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-foreground/80 text-xs"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              className="mt-5 h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              disabled={phase === "processing"}
              onClick={confirm}
              type="button"
            >
              {phase === "processing"
                ? "Обрабатываем…"
                : isFree
                  ? "Подтвердить"
                  : `Оплатить ${plan.priceRub} ₽`}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

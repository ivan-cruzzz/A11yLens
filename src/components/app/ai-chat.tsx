"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareIcon, SendIcon, SparklesIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  IMPACT_LABELS,
  IMPACT_ORDER,
  type ScanResult,
} from "@/lib/types";
import { buildAdvice } from "@/lib/knowledge";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

const QUICK_PROMPTS = [
  "С чего начать исправления?",
  "Как исправить контраст?",
  "Что значит критичность?",
  "Как проверить скринридером?",
];

/**
 * Rule-based ответы по текущему отчёту (без внешнего API):
 * ищем самое критичное нарушение и отдаём совет из knowledge.
 */
function answerFor(question: string, result: ScanResult | null): string {
  const q = question.toLowerCase();

  if (!result) {
    return "Сначала запустите сканирование — я разберу отчёт и подскажу, что исправлять в первую очередь.";
  }

  const worst = [...result.violations].sort(
    (a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]
  )[0];

  if (q.includes("начать") || q.includes("перв")) {
    if (!worst) {
      return "Нарушений не найдено — отличная работа! Загляните в гайд по WCAG, чтобы удержать уровень.";
    }
    const advice = buildAdvice(worst.id, "deep", "full");
    return `Начните с самого критичного: «${worst.title}» (${worst.nodes.length} элемент(ов), критичность — ${IMPACT_LABELS[worst.impact]}). ${advice.short}`;
  }

  if (q.includes("контраст")) {
    const contrast = result.violations.find((v) => v.category === "contrast");
    if (contrast) {
      return buildAdvice(contrast.id, "deep", "full").full;
    }
    return "Проблем с контрастом не найдено. Норма: обычный текст 4.5:1, крупный — 3:1 (WCAG 1.4.3).";
  }

  if (q.includes("критичн") || q.includes("значит")) {
    return "Критичность показывает, насколько сильно нарушение мешает пользователям: критичная — блокирует доступ, серьёзная — сильно мешает, средняя — неудобна, незначительная — мелочь. Исправляйте сверху вниз.";
  }

  if (q.includes("скринридер")) {
    return "Проверка скринридером: 1) включите NVDA (Windows) или VoiceOver (Mac: Cmd+F5); 2) пройдите страницу стрелками с верха; 3) убедитесь, что каждый интерактивный элемент объявляет название и роль; 4) заголовки должны образовывать логичную структуру.";
  }

  if (q.includes("alt") || q.includes("картин")) {
    const alt = result.violations.find((v) => v.category === "alt");
    if (alt) {
      return buildAdvice(alt.id, "deep", "full").full;
    }
    return "С alt-текстами порядок. Правило: содержательные изображения — описательный alt, декоративные — alt=\"\" (пустой), сложные диаграммы — длинное описание рядом.";
  }

  if (q.includes("клавиатур") || q.includes("фокус")) {
    return "Клавиатурная навигация: Tab — вперёд, Shift+Tab — назад, Enter/Space — активация. Фокус всегда должен быть виден (WCAG 2.4.7), а порядок обхода — совпадать с визуальным.";
  }

  if (worst) {
    const advice = buildAdvice(worst.id, "deep", "short");
    return `По вашему отчёту главное — «${worst.title}». ${advice.short} Спросите подробнее: «как исправить ${CATEGORY_LABELS[worst.category].toLowerCase()}».`;
  }

  return "В отчёте нарушений нет. Могу рассказать про критерии WCAG, скринридеры или клавиатурную навигацию.";
}

/** Плавающий ИИ-помощник: rule-based ответы по текущему отчёту, без API. */
export default function AiChat({ result }: { result: ScanResult | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text) {
      return;
    }
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: "user", text },
    ]);
    setInput("");
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          text: answerFor(text, result),
        },
      ]);
    }, 450);
  };

  return (
    <>
      {result ? (
        <motion.button
          animate={{ opacity: 1, scale: 1 }}
          aria-expanded={open}
          aria-label={open ? "Закрыть ИИ-помощника" : "Открыть ИИ-помощника"}
          className="fixed right-4 bottom-4 z-[90] grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          initial={{ opacity: 0, scale: 0.8 }}
          onClick={() => setOpen((value) => !value)}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          type="button"
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        >
          {open ? (
            <XIcon aria-hidden="true" className="size-5" />
          ) : (
            <SparklesIcon aria-hidden="true" className="size-5" />
          )}
        </motion.button>
      ) : null}

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  animate={
                    reduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, scale: 1, y: 0 }
                  }
                  aria-label="ИИ-помощник по отчёту"
                  className="fixed right-4 bottom-20 z-[95] flex h-[420px] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.96, y: 10 }
                  }
                  initial={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.96, y: 14 }
                  }
                  role="dialog"
                  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="flex items-center gap-2 border-border border-b px-4 py-3">
                    <MessageSquareIcon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                    <h2 className="font-medium text-sm">ИИ-помощник</h2>
                    <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-muted-foreground text-[10px]">
                      демо · без API
                    </span>
                  </div>

                  <div
                    className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
                    ref={listRef}
                  >
                    {messages.length === 0 ? (
                      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                        Разберу ваш отчёт и подскажу, что исправлять. Выберите
                        вопрос или напишите свой.
                      </p>
                    ) : null}
                    {messages.map((message) => (
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed",
                          message.role === "user"
                            ? "ml-auto bg-foreground text-background"
                            : "border border-border bg-background"
                        )}
                        key={message.id}
                      >
                        {message.text}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5 border-border border-t px-3 pt-2.5">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        className="rounded-full border border-border px-2.5 py-1 text-muted-foreground text-[11px] transition-colors hover:border-foreground/40 hover:text-foreground"
                        key={prompt}
                        onClick={() => ask(prompt)}
                        type="button"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <form
                    className="flex items-center gap-2 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      ask(input);
                    }}
                  >
                    <label className="sr-only" htmlFor="ai-chat-input">
                      Вопрос помощнику
                    </label>
                    <input
                      className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
                      id="ai-chat-input"
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="Спросите про отчёт…"
                      type="text"
                      value={input}
                    />
                    <button
                      aria-label="Отправить"
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                      type="submit"
                    >
                      <SendIcon aria-hidden="true" className="size-4" />
                    </button>
                  </form>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  );
}

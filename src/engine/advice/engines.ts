import { tipFor } from "./tips";

/**
 * «Движки разбора» — глубина текстов советов. Переехало из src/lib/knowledge.ts.
 * Реальный ИИ не используется: это чистые словари и шаблоны.
 */

export type EngineId = "express" | "deep" | "strict";

export const ENGINE_OPTIONS: {
  id: EngineId;
  name: string;
  description: string;
  efforts: { id: string; label: string; hint?: string }[];
  defaultEffort?: string;
}[] = [
  {
    id: "express",
    name: "Экспресс-движок",
    description: "Одна строка на нарушение — быстро и по делу",
    efforts: [
      {
        id: "low",
        label: "Кратко",
        hint: "Суть проблемы одной строкой.",
      },
      {
        id: "medium",
        label: "Развёрнуто",
        hint: "Короткий совет + причина.",
      },
    ],
    defaultEffort: "low",
  },
  {
    id: "deep",
    name: "Глубокий анализ",
    description: "Пошаговые рецепты и примеры кода",
    efforts: [
      { id: "medium", label: "Стандарт", hint: "Совет + шаги исправления." },
      {
        id: "high",
        label: "С кодом",
        hint: "Добавляет пример кода к каждому совету.",
      },
    ],
    defaultEffort: "medium",
  },
  {
    id: "strict",
    name: "Строгий аудит",
    description: "Максимальная детализация + ссылки на WCAG",
    efforts: [
      { id: "high", label: "Подробно", hint: "Всё из глубокого режима." },
      {
        id: "max",
        label: "Максимум",
        hint: "Полный разбор + чек-лист проверки.",
      },
    ],
    defaultEffort: "max",
  },
];

export interface Advice {
  short: string;
  full: string;
  wcag: string;
}

export type DetailLevel = "short" | "full";

export function buildAdvice(
  ruleId: string,
  engine: EngineId,
  detail: DetailLevel
): Advice {
  const tip = tipFor(ruleId);
  const short =
    engine === "express" && detail === "short"
      ? tip.short
      : `${tip.short} (WCAG ${tip.wcag})`;

  let full = tip.full;
  if (engine === "strict") {
    full += `\n\nЧек-лист проверки: 1) исправьте разметку по рецепту; 2) перепроверьте сканером; 3) пройдите по странице с клавиатуры; 4) проверьте объявление в скринридере. Критерий WCAG ${tip.wcag}.`;
    if (tip.code) {
      full += `\n\nПример:\n${tip.code}`;
    }
  } else if (engine === "deep" && tip.code && detail === "full") {
    full += `\n\nПример:\n${tip.code}`;
  }

  return { short, full, wcag: tip.wcag };
}

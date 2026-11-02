import type {
  Category,
  Impact,
  SecuritySeverity,
} from "../lib/report-types";

/** Русские подписи — повторяют словари веба (types.ts), но локальны для окна. */

export const IMPACT_LABELS: Record<Impact, string> = {
  critical: "критичный",
  serious: "серьёзный",
  moderate: "средний",
  minor: "незначительный",
};

export const SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  high: "высокая",
  medium: "средняя",
  low: "низкая",
  info: "инфо",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  contrast: "контраст",
  alt: "alt-тексты",
  keyboard: "клавиатура",
  forms: "формы",
  aria: "ARIA",
  other: "другое",
};

export const CATEGORY_ORDER: readonly Category[] = [
  "contrast",
  "alt",
  "keyboard",
  "forms",
  "aria",
  "other",
];

export const MODE_TITLE_LABELS: Record<string, string> = {
  quick: "быстро",
  normal: "обычно",
  deep: "глубоко",
};

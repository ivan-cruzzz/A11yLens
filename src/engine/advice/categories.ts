import type { Category } from "../types";

/** Маппинг правила axe-core на категорию отчёта. Переехал из src/lib/knowledge.ts. */
export function categoryOf(ruleId: string): Category {
  if (ruleId === "color-contrast" || ruleId === "link-in-text-block") {
    return "contrast";
  }
  if (
    ruleId.includes("alt") ||
    ruleId === "frame-title" ||
    ruleId === "image-redundant-alt"
  ) {
    return "alt";
  }
  if (
    [
      "keyboard",
      "tabindex",
      "focus-order-semantics",
      "interactive-supports-focus",
      "focusable-content",
      "scrollable-region-focusable",
      "target-size",
      "bypass",
    ].includes(ruleId)
  ) {
    return "keyboard";
  }
  if (
    [
      "label",
      "select-name",
      "autocomplete-valid",
      "button-name",
      "link-name",
      "aria-input-field-name",
      "aria-toggle-field-name",
    ].includes(ruleId)
  ) {
    return "forms";
  }
  if (
    ruleId.startsWith("aria-") ||
    [
      "landmark-one-main",
      "region",
      "heading-order",
      "empty-heading",
      "list",
      "listitem",
      "definition-list",
      "dlitem",
      "nested-interactive",
      "duplicate-id-aria",
      "html-has-lang",
      "html-lang-valid",
      "page-title",
      "landmark-unique",
      "landmark-no-duplicate-banner",
      "landmark-no-duplicate-contentinfo",
    ].includes(ruleId)
  ) {
    return "aria";
  }
  return "other";
}

/**
 * Словарь советов живёт в движке (src/engine/advice/) — шов по interfaces.md.
 * Здесь только реэкспорт для старых импортов "@/lib/knowledge":
 * violation-row, ai-chat, pdf и страница сканера.
 */

export {
  categoryOf,
  buildAdvice,
  ENGINE_OPTIONS,
  RULE_TIPS,
  tipFor,
  whyForRule,
  whyForSecurity,
} from "../engine/advice";
export type {
  Advice,
  DetailLevel,
  EngineId,
  Tip,
} from "../engine/advice";

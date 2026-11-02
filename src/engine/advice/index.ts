/**
 * Словари советов и объяснений — шов движка (interfaces.md: движок владеет
 * словарём советов). Веб получает их через реэкспорт "@/lib/knowledge",
 * CLI и десктоп импортируют напрямую отсюда.
 */

export {
  RULE_TIPS,
  tipFor,
  type Tip,
} from "./tips";
export {
  buildAdvice,
  ENGINE_OPTIONS,
  type Advice,
  type DetailLevel,
  type EngineId,
} from "./engines";
export { categoryOf } from "./categories";
export {
  whyForRule,
  whyForSecurity,
  ruleWhyCoverageGaps,
} from "./explain";

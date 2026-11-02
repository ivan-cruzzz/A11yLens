import { describe, expect, it } from "vitest";
import {
  RULE_TIPS,
  whyForRule,
  whyForSecurity,
} from "../../src/engine/advice";
import { SECURITY_CHECKS } from "../../src/engine";
import {
  buildAdvice,
  categoryOf,
  ENGINE_OPTIONS,
  tipFor,
} from "../../src/lib/knowledge";

describe("whyForRule — «почему это проблема» по-человечески", () => {
  it("у каждого правила из словаря советов есть непустое объяснение", () => {
    const ruleIds = Object.keys(RULE_TIPS);
    expect(ruleIds.length).toBeGreaterThanOrEqual(30);
    for (const ruleId of ruleIds) {
      const why = whyForRule(ruleId);
      expect(why.length, `пустое объяснение для ${ruleId}`).toBeGreaterThan(30);
    }
  });

  it("объяснение говорит про человека, а не про правило", () => {
    expect(whyForRule("color-contrast")).toMatch(/пользовател|человек/i);
  });

  it("неизвестное правило получает осмысленный fallback", () => {
    expect(whyForRule("совсем-неизвестное-правило").length).toBeGreaterThan(30);
  });
});

describe("whyForSecurity — объяснение для каждой проверки реестра", () => {
  it("у каждой проверки из SECURITY_CHECKS есть непустое объяснение", () => {
    expect(SECURITY_CHECKS.length).toBe(20);
    for (const check of SECURITY_CHECKS) {
      const why = whyForSecurity(check.id);
      expect(why.length, `пустое объяснение для ${check.id}`).toBeGreaterThan(
        30
      );
    }
  });

  it("неизвестная проверка получает fallback", () => {
    expect(whyForSecurity("sec-неизвестная").length).toBeGreaterThan(30);
  });
});

describe("словарь советов переехал в движок, lib-импорты живы", () => {
  it("старые импорты из @/lib/knowledge работают и совпадают с движком", () => {
    expect(tipFor("color-contrast").wcag).toBe("1.4.3");
    expect(categoryOf("image-alt")).toBe("alt");
    expect(ENGINE_OPTIONS.map((e) => e.id)).toEqual([
      "express",
      "deep",
      "strict",
    ]);
    expect(buildAdvice("color-contrast", "strict", "full").full).toContain(
      "Чек-лист"
    );
  });
});

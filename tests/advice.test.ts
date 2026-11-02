import { describe, expect, it } from "vitest";
import {
  ENGINE_OPTIONS,
  buildAdvice,
  categoryOf,
  tipFor,
} from "../src/lib/knowledge";

describe("tipFor", () => {
  it("известное правило отдаёт свой совет с критерием WCAG", () => {
    expect(tipFor("color-contrast").wcag).toBe("1.4.3");
  });

  it("неизвестное правило получает fallback-совет", () => {
    const tip = tipFor("какое-то-неизвестное-правило");
    expect(tip.short).toContain("axe");
    expect(tip.wcag).toBe("4.1");
  });
});

describe("buildAdvice", () => {
  it("экспресс + кратко → одна строка без приписки WCAG", () => {
    const advice = buildAdvice("color-contrast", "express", "short");
    expect(advice.short).toBe(tipFor("color-contrast").short);
  });

  it("не-экспресс добавляет критерий WCAG к короткому совету", () => {
    const advice = buildAdvice("color-contrast", "deep", "short");
    expect(advice.short).toBe(`${tipFor("color-contrast").short} (WCAG 1.4.3)`);
  });

  it("строгий движок добавляет чек-лист и пример кода", () => {
    const advice = buildAdvice("color-contrast", "strict", "full");
    expect(advice.full).toContain("Чек-лист проверки");
    expect(advice.full).toContain("Пример:");
    expect(advice.full).toContain("WCAG 1.4.3");
  });

  it("глубокий + подробно добавляет пример кода без чек-листа", () => {
    const advice = buildAdvice("color-contrast", "deep", "full");
    expect(advice.full).toContain("Пример:");
    expect(advice.full).not.toContain("Чек-лист проверки");
  });

  it("у движков разбора три опции с уникальными id", () => {
    const ids = ENGINE_OPTIONS.map((engine) => engine.id);
    expect(ids).toEqual(["express", "deep", "strict"]);
    expect(new Set(ids).size).toBe(3);
  });
});

describe("categoryOf", () => {
  it.each([
    ["color-contrast", "contrast"],
    ["link-in-text-block", "contrast"],
    ["image-alt", "alt"],
    ["frame-title", "alt"],
    ["button-name", "forms"],
    ["label", "forms"],
    ["link-name", "forms"],
    ["bypass", "keyboard"],
    ["target-size", "keyboard"],
    ["aria-required-children", "aria"],
    ["html-has-lang", "aria"],
    ["heading-order", "aria"],
    ["region", "aria"],
    ["meta-viewport", "other"],
    ["what-ever-else", "other"],
  ] as const)("правило %s → категория %s", (ruleId, category) => {
    expect(categoryOf(ruleId)).toBe(category);
  });
});

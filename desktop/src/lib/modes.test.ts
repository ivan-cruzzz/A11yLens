import { describe, expect, it } from "vitest";
import { MODES, MODE_ORDER, type ModeId } from "./modes";

describe("MODES — единый конфиг интенсивности (R04.2)", () => {
  it("три режима: quick, normal, deep — и никакого другого набора", () => {
    expect(MODE_ORDER).toEqual(["quick", "normal", "deep"]);
    expect(Object.keys(MODES).sort()).toEqual(["deep", "normal", "quick"]);
  });

  it("каждый режим прокидывает свой --mode в CLI", () => {
    expect(MODES.quick.mode).toBe("quick");
    expect(MODES.normal.mode).toBe("normal");
    expect(MODES.deep.mode).toBe("deep");
  });

  it("лимит страниц растёт от quick к deep", () => {
    expect(MODES.quick.maxPages).toBeLessThan(MODES.normal.maxPages);
    expect(MODES.normal.maxPages).toBeLessThan(MODES.deep.maxPages);
  });

  it("таймаут растёт от quick к deep", () => {
    expect(MODES.quick.timeoutMs).toBeLessThan(MODES.normal.timeoutMs);
    expect(MODES.normal.timeoutMs).toBeLessThan(MODES.deep.timeoutMs);
  });

  it("конкретные значения: quick 2 страницы/45с, normal 4/90с, deep 8/180с", () => {
    expect(MODES.quick.maxPages).toBe(2);
    expect(MODES.quick.timeoutMs).toBe(45_000);
    expect(MODES.normal.maxPages).toBe(4);
    expect(MODES.normal.timeoutMs).toBe(90_000);
    expect(MODES.deep.maxPages).toBe(8);
    expect(MODES.deep.timeoutMs).toBe(180_000);
  });

  it("у каждого режима есть русская подпись и описание", () => {
    for (const id of MODE_ORDER as ModeId[]) {
      expect(MODES[id].label.length).toBeGreaterThan(0);
      expect(MODES[id].description.length).toBeGreaterThan(0);
    }
  });
});

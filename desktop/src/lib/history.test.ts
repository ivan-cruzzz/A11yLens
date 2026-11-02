import { describe, expect, it } from "vitest";
import { MAX_HISTORY, mergeHistory } from "./history";
import type { HistoryEntry } from "./history";

const entry = (id: string): HistoryEntry => ({
  id,
  url: "https://example.com/",
  host: "example.com",
  mode: "normal",
  scannedAt: "2026-11-02T12:00:00.000Z",
  complete: true,
  pagesDone: 4,
  pagesPlanned: 4,
  scores: { a11y: 90, security: 80, native: 100 },
  report: null,
});

describe("mergeHistory — локальная история сканов (R04)", () => {
  it("новая запись оказывается первой", () => {
    const list = mergeHistory([entry("old")], entry("new"));
    expect(list[0]?.id).toBe("new");
    expect(list[1]?.id).toBe("old");
  });

  it("история ограничена MAX_HISTORY записями — уходит самая старая", () => {
    const old = Array.from({ length: MAX_HISTORY }, (_, i) => entry(`e${i}`));
    const list = mergeHistory(old, entry("fresh"));
    expect(list.length).toBe(MAX_HISTORY);
    expect(list[0]?.id).toBe("fresh");
    expect(list.some((e) => e.id === "e49")).toBe(false);
    expect(list.some((e) => e.id === "e48")).toBe(true);
  });

  it("не мутирует переданный список", () => {
    const original = [entry("a")];
    mergeHistory(original, entry("b"));
    expect(original.map((e) => e.id)).toEqual(["a"]);
  });
});

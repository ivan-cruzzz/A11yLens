import { describe, expect, it } from "vitest";
import { buildEngineArgs } from "./sidecar-args";

describe("buildEngineArgs — аргументы sidecar из одного конфига", () => {
  it("обычный скан: scan <url> --json --mode --max-pages --timeout", () => {
    const args = buildEngineArgs({ url: "example.com", modeId: "normal" });
    expect(args).toEqual([
      "scan",
      "example.com",
      "--json",
      "--mode",
      "normal",
      "--max-pages",
      "4",
      "--timeout",
      "90000",
    ]);
  });

  it("quick-режим даёт меньший --max-pages и --timeout", () => {
    const args = buildEngineArgs({ url: "https://example.com", modeId: "quick" });
    expect(args).toContain("--mode");
    expect(args[args.indexOf("--mode") + 1]).toBe("quick");
    expect(args[args.indexOf("--max-pages") + 1]).toBe("2");
    expect(args[args.indexOf("--timeout") + 1]).toBe("45000");
  });

  it("продолжение после обрыва: --max-pages = осталось страниц, а не весь план (R04.3)", () => {
    const args = buildEngineArgs({
      url: "https://example.com",
      modeId: "normal",
      pagesDone: 3,
    });
    expect(args[args.indexOf("--max-pages") + 1]).toBe("1");
  });

  it("продолжение, когда не просканировано ничего, — план целиком", () => {
    const args = buildEngineArgs({
      url: "https://example.com",
      modeId: "deep",
      pagesDone: 0,
    });
    expect(args[args.indexOf("--max-pages") + 1]).toBe("8");
  });

  it("URL передаётся как есть — нормализацию делает движок sidecar", () => {
    const args = buildEngineArgs({ url: "mysite.ru", modeId: "quick" });
    expect(args[0]).toBe("scan");
    expect(args[1]).toBe("mysite.ru");
  });
});

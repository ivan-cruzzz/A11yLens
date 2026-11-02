import { describe, expect, it } from "vitest";
import { isPlaywrightMissing, parseEngineOutput } from "./engine-json";
import type { EngineReport } from "./report-types";

const fullReport: EngineReport = {
  scan: {
    url: "https://example.com/",
    host: "example.com",
    scannedAt: "2026-11-02T12:00:00.000Z",
    standard: "AA",
    device: "desktop",
    score: 90,
    counts: { contrast: 1, alt: 0, keyboard: 0, forms: 0, aria: 0, other: 0 },
    totalViolations: 1,
    totalNodes: 2,
    meta: { title: "Example", loadMs: 500, rulesRun: 60, passedRules: 59, incompleteRules: 0 },
    violations: [],
  },
  native: null,
};

describe("parseEngineOutput — разбор stdout sidecar", () => {
  it("целый JSON со scan и native разбирается", () => {
    const parsed = parseEngineOutput(JSON.stringify(fullReport));
    expect(parsed).not.toBeNull();
    expect(parsed?.scan?.host).toBe("example.com");
    expect(parsed?.scan?.score).toBe(90);
  });

  it("переводы строк вокруг JSON не мешают", () => {
    const parsed = parseEngineOutput(`\n${JSON.stringify(fullReport)}\n`);
    expect(parsed?.scan?.host).toBe("example.com");
  });

  it("пустой вывод (обрыв процесса без отчёта) — null", () => {
    expect(parseEngineOutput("")).toBeNull();
    expect(parseEngineOutput("   \n")).toBeNull();
  });

  it("мусор вместо JSON (stderr попал в stdout, обрыв на середине) — null", () => {
    expect(parseEngineOutput("Error: site is down")).toBeNull();
    expect(parseEngineOutput('{"scan": {"url": "https://x"}} oops')).toBeNull();
  });

  it("JSON без поля scan — это не отчёт, null", () => {
    expect(parseEngineOutput(JSON.stringify({ hello: 1 }))).toBeNull();
  });
});

describe("isPlaywrightMissing — подсказка о докачке Chromium (R04.1)", () => {
  it("узнаёт сообщение Playwright про отсутствующий браузер", () => {
    expect(
      isPlaywrightMissing(
        "browserType.launch: Executable doesn't exist at ...\\chromium-1248\\chrome-win\\chrome.exe"
      )
    ).toBe(true);
  });

  it("узнаёт подсказку установки", () => {
    expect(isPlaywrightMissing("run npx playwright install chromium")).toBe(true);
  });

  it("сетевые ошибки — не про браузер", () => {
    expect(isPlaywrightMissing("net::ERR_NAME_NOT_RESOLVED at https://nope.example")).toBe(false);
    expect(isPlaywrightMissing("")).toBe(false);
  });
});

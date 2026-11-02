import { afterEach, describe, expect, it, vi } from "vitest";
import { runScanCommand, type ScanCommandDeps } from "../../src/cli/scan-command";
import type { NativeReport } from "../../src/engine/native";
import type { ScanOptions, ScanResult } from "../../src/engine";

afterEach(() => {
  vi.restoreAllMocks();
});

const scanResult = (overrides: Partial<ScanResult> = {}): ScanResult =>
  ({
    url: "https://example.com/",
    host: "example.com",
    scannedAt: "2026-11-02T12:00:00.000Z",
    standard: "AA",
    device: "desktop",
    score: 72,
    counts: { contrast: 1, alt: 0, keyboard: 0, forms: 0, aria: 0, other: 0 },
    totalViolations: 1,
    totalNodes: 1,
    meta: { title: "Example", loadMs: 120, rulesRun: 5, passedRules: 4, incompleteRules: 0 },
    violations: [
      {
        id: "color-contrast",
        title: "Элементы с недостаточным контрастом",
        help: "Элементы с недостаточным контрастом",
        helpUrl: "https://deque.university/rules/color-contrast",
        impact: "serious",
        category: "contrast",
        tags: ["wcag2aa"],
        nodes: [{ selector: "div > p", snippet: "<p>текст</p>" }],
      },
    ],
    security: {
      score: 45,
      checksRun: 20,
      findings: [
        {
          id: "sec-csp",
          title: "Нет Content-Security-Policy",
          severity: "high",
          detail: "Заголовок CSP отсутствует.",
          recommendation: "Добавьте Content-Security-Policy.",
        },
      ],
    },
    ...overrides,
  }) as ScanResult;

const nativeReport = (overrides: Partial<NativeReport> = {}): NativeReport =>
  ({
    url: "https://example.com/",
    host: "example.com",
    scannedAt: "2026-11-02T12:00:00.000Z",
    mode: "normal",
    score: 55,
    findings: [
      {
        id: "ncve-jquery",
        title: "Уязвимые версии jQuery (OSV)",
        severity: "high",
        detail: "На странице jQuery 3.4.0: CVE-2020-11022.",
        evidence: "OSV querybatch: jquery@3.4.0 → GHSA-j8xg-fqg3-53r7",
        recommendation: "Обновите jQuery. Ссылки: https://osv.dev/vulnerability/CVE-2020-11022",
      },
    ],
    checksRun: 6,
    technologies: [{ name: "jQuery", version: "3.4.0", category: "library" }],
    subdomains: ["api.example.com"],
    openPorts: [445],
    degradations: [],
    ...overrides,
  }) as NativeReport;

const depsWith = (
  overrides: Partial<ScanCommandDeps> = {},
  scan = scanResult(),
  native = nativeReport()
) => {
  const out: string[] = [];
  const err: string[] = [];
  const base = {
    out,
    err,
    runScan: vi.fn(async (_options: ScanOptions): Promise<ScanResult> => scan),
    runNativeAudit: vi.fn(
      async (_url: string, _mode: "quick" | "normal" | "deep"): Promise<NativeReport> => native
    ),
    writeOut: (text: string) => {
      out.push(text);
    },
    writeErr: (text: string) => {
      err.push(text);
    },
  };
  return Object.assign(base, overrides);
};

describe("runScanCommand", () => {
  it("полный отчёт: оба сканера запущены, exit 0, в выводе скоры и план", async () => {
    const deps = depsWith();
    const code = await runScanCommand("https://example.com", {}, deps);

    expect(code).toBe(0);
    expect(deps.runScan).toHaveBeenCalledTimes(1);
    expect(deps.runNativeAudit).toHaveBeenCalledWith("https://example.com/", "normal");
    const text = deps.out.join("");
    expect(text).toContain("example.com");
    expect(text).toContain("72/100");
    expect(text).toContain("45/100");
    expect(text).toContain("55/100");
    expect(text).toContain("План исправления");
    expect(text).toContain("Content-Security-Policy");
    expect(deps.err).toEqual([]);
  });

  it("--json: машиночитаемый JSON со scan и native, без ANSI-кодов", async () => {
    const deps = depsWith();
    const code = await runScanCommand("https://example.com", { json: true }, deps);

    expect(code).toBe(0);
    const text = deps.out.join("");
    expect(text).not.toContain("\u001b[");
    const parsed = JSON.parse(text) as { scan: ScanResult; native: NativeReport };
    expect(parsed.scan.score).toBe(72);
    expect(parsed.native.score).toBe(55);
    expect(parsed.native.subdomains).toEqual(["api.example.com"]);
  });

  it("--csv: строки трёх типов — a11y, security, native", async () => {
    const deps = depsWith();
    const code = await runScanCommand("https://example.com", { csv: true }, deps);

    expect(code).toBe(0);
    const text = deps.out.join("");
    expect(text).toContain('"a11y","color-contrast"');
    expect(text).toContain('"security","sec-csp"');
    expect(text).toContain('"native","ncve-jquery"');
    // Заголовок таблицы на месте.
    expect(text).toContain('"type","id","title","severity","detail"');
  });

  it("--fail-under 80: худший скор 45 < 80 → exit 1", async () => {
    const deps = depsWith();
    const code = await runScanCommand("https://example.com", { failUnder: 80 }, deps);
    expect(code).toBe(1);
  });

  it("--fail-under 40: худший скор 45 ≥ 40 → exit 0", async () => {
    const deps = depsWith();
    const code = await runScanCommand("https://example.com", { failUnder: 40 }, deps);
    expect(code).toBe(0);
  });

  it("--a11y-only: нативный аудит не запускается, нативной секции нет", async () => {
    const deps = depsWith();
    const code = await runScanCommand("https://example.com", { a11yOnly: true }, deps);

    expect(code).toBe(0);
    expect(deps.runNativeAudit).not.toHaveBeenCalled();
    const text = deps.out.join("");
    expect(text).toContain("72/100");
    expect(text).not.toContain("Нативные");
  });

  it("--security-only: секция нарушений доступности скрыта, нативный аудит запущен", async () => {
    const deps = depsWith();
    const code = await runScanCommand("https://example.com", { securityOnly: true }, deps);

    expect(code).toBe(0);
    expect(deps.runNativeAudit).toHaveBeenCalledTimes(1);
    const text = deps.out.join("");
    expect(text).toContain("45/100");
    expect(text).not.toContain("Нарушения доступности");
  });

  it("--mode quick передаётся в нативный аудит", async () => {
    const deps = depsWith();
    await runScanCommand("https://example.com", { mode: "quick" }, deps);
    expect(deps.runNativeAudit).toHaveBeenCalledWith("https://example.com/", "quick");
  });

  it("--max-pages передаётся в runScan", async () => {
    const deps = depsWith();
    await runScanCommand("https://example.com", { maxPages: 3 }, deps);
    const options = deps.runScan.mock.calls[0][0];
    expect(options.maxPages).toBe(3);
  });

  it("ошибка Playwright-браузера → ровно одна подсказка с командой установки, exit 2", async () => {
    const deps = depsWith({
      runScan: vi.fn(async () => {
        throw new Error(
          "browserType.launch: Executable doesn't exist at %LOCALAPPDATA%\\ms-playwright\\chromium-1243"
        );
      }),
    });
    const code = await runScanCommand("https://example.com", {}, deps);

    expect(code).toBe(2);
    const errText = deps.err.join("");
    expect(errText.match(/npx playwright install chromium/g)).toHaveLength(1);
    expect(deps.out).toEqual([]);
  });

  it("недоступный сайт (DNS) → понятная ошибка с причиной, exit 2", async () => {
    const deps = depsWith({
      runScan: vi.fn(async () => {
        throw new Error("page.goto: net::ERR_NAME_NOT_RESOLVED at https://example.com");
      }),
    });
    const code = await runScanCommand("https://example.com", {}, deps);

    expect(code).toBe(2);
    expect(deps.err.join("")).toContain("Сайт не открылся");
    expect(deps.err.join("")).toContain("DNS");
  });

  it("внутренний адрес отсекается до запуска сканеров → exit 2", async () => {
    const deps = depsWith();
    const code = await runScanCommand("localhost", {}, deps);

    expect(code).toBe(2);
    expect(deps.runScan).not.toHaveBeenCalled();
    expect(deps.runNativeAudit).not.toHaveBeenCalled();
    expect(deps.err.join("")).toContain("Внутренние адреса");
  });

  it("--timeout: скан дольше лимита → ошибка и exit 2", async () => {
    const deps = depsWith({
      runScan: vi.fn(
        () => new Promise<ScanResult>((resolve) => setTimeout(() => resolve(scanResult()), 500))
      ),
    });
    const code = await runScanCommand("https://example.com", { timeout: 50 }, deps);

    expect(code).toBe(2);
    expect(deps.err.join("")).toContain("--timeout");
  });
});

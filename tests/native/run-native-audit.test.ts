import { describe, expect, it } from "vitest";
import {
  NATIVE_CHECKS,
  NATIVE_MODES,
  runNativeAudit,
  type NativeAuditDeps,
} from "../../src/engine/native";
import { computeSecurityScore } from "../../src/engine/scoring";

const certDate = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toUTCString();

const okJson = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload });

/** Все сети замоканы: ни один вызов не выходит наружу. */
const fullDeps = (): NativeAuditDeps => ({
  dnsGuard: async () => undefined,
  fetchPage: async () => ({
    ok: true,
    status: 200,
    html: '<script src="https://code.jquery.com/jquery-3.4.0.min.js"></script>',
    headers: {},
  }),
  probeTls: async () => ({
    handshake: true,
    protocol: "TLSv1.3",
    authorized: true,
    cert: {
      validTo: certDate(-2),
      subjectCN: "example.com",
      altNames: ["example.com"],
    },
  }),
  probePort: async (_host, port) => port === 445,
  fetchCrtSh: async () => [{ name_value: "api.example.com\nlost.example.com" }],
  resolveHost: async (host) => host === "api.example.com",
  resolveTxt: async () => {
    throw new Error("queryTxt ENODATA");
  },
  osvFetch: async (url) =>
    url.endsWith("/querybatch")
      ? okJson({ results: [{ vulns: [{ id: "GHSA-j8xg-fqg3-53r7" }] }] })
      : okJson({ id: "GHSA-j8xg-fqg3-53r7", aliases: ["CVE-2020-11022"] }),
});

describe("runNativeAudit", () => {
  it("полный аудит на моках: находки всех пяти проверок, скор из scoring, реестр проверок", async () => {
    const report = await runNativeAudit("https://example.com", "normal", fullDeps());

    expect(report.error).toBeUndefined();
    expect(report.host).toBe("example.com");
    expect(report.checksRun).toBe(NATIVE_CHECKS.length);
    expect(report.score).toBe(computeSecurityScore(report.findings));

    const ids = report.findings.map((f) => f.id);
    expect(ids).toContain("ntls-expired");
    expect(ids).toContain("nport-445");
    expect(ids).toContain("nsub-inventory");
    expect(ids).toContain("nmail-no-spf");
    expect(ids).toContain("nmail-no-dkim");
    expect(ids).toContain("ncve-jquery");

    // Находки отсортированы по критичности.
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };
    const ranks = report.findings.map((f) => rank[f.severity]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);

    expect(report.subdomains).toEqual(["api.example.com"]);
    expect(report.openPorts).toEqual([445]);
    expect(report.technologies.map((t) => t.name)).toContain("jQuery");
    expect(report.degradations).toEqual([]);
    expect(report.mode).toBe("normal");
  });

  it("внутренний адрес без allow-флага → error-отчёт без сканеров (SSRF)", async () => {
    let scannersTouched = 0;
    const deps = fullDeps();
    deps.fetchPage = async () => {
      scannersTouched += 1;
      return { ok: true, status: 200, html: "", headers: {} };
    };
    const report = await runNativeAudit("http://localhost:3000", "normal", deps);

    expect(report.error).toContain("Внутренние адреса");
    expect(report.findings).toEqual([]);
    expect(scannersTouched).toBe(0);
  });

  it("страница не скачалась → деградация; TLS и порты всё равно проверены", async () => {
    const deps = fullDeps();
    deps.fetchPage = async () => {
      throw new Error("net::ERR_CONNECTION_REFUSED");
    };
    const report = await runNativeAudit("https://example.com", "normal", deps);

    expect(report.degradations.some((d) => d.includes("Страница"))).toBe(true);
    expect(report.findings.map((f) => f.id)).toContain("ntls-expired");
    expect(report.findings.map((f) => f.id)).toContain("nport-445");
    expect(report.technologies).toEqual([]);
  });

  it("OSV недоступен → деградация с пометкой, остальные проверки живут", async () => {
    const deps = fullDeps();
    deps.osvFetch = async () => ({ ok: false, status: 503, json: async () => null });
    const report = await runNativeAudit("https://example.com", "normal", deps);

    expect(report.degradations.some((d) => d.includes("OSV"))).toBe(true);
    expect(report.findings.map((f) => f.id)).toContain("ncve-osv-unavailable");
    expect(report.findings.map((f) => f.id)).toContain("nport-445");
  });

  it("режимы quick|normal|deep различаются лимитами поддоменов", () => {
    expect(NATIVE_MODES.quick.subdomainLimit).toBeLessThan(NATIVE_MODES.normal.subdomainLimit);
    expect(NATIVE_MODES.normal.subdomainLimit).toBeLessThan(NATIVE_MODES.deep.subdomainLimit);
  });

  it("режим deep попадает в отчёт", async () => {
    const report = await runNativeAudit("https://example.com", "deep", fullDeps());
    expect(report.mode).toBe("deep");
  });
});

import { describe, expect, it } from "vitest";
import {
  auditTls,
  type TlsProbeFn,
  type TlsProbeOutcome,
} from "../../src/engine/native/tls";

/** Дата в формате сертификата (valid_to), смещённая на days дней от сейчас. */
const certDate = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toUTCString();

const probeOk = (overrides: Partial<TlsProbeOutcome> = {}): TlsProbeOutcome => ({
  handshake: true,
  protocol: "TLSv1.3",
  authorized: true,
  cert: {
    validTo: certDate(90),
    subjectCN: "example.com",
    issuerCN: "R3",
    altNames: ["example.com", "www.example.com"],
  },
  ...overrides,
});

describe("auditTls", () => {
  it("истёкший сертификат → находка ntls-expired (high) с доказательством", async () => {
    const findings = await auditTls("example.com", {
      probe: async () => probeOk({ cert: { ...probeOk().cert!, validTo: certDate(-3) } }),
    });
    const expired = findings.find((f) => f.id === "ntls-expired");
    expect(expired).toBeDefined();
    expect(expired?.severity).toBe("high");
    expect(expired?.evidence).toContain("GMT");
    expect(expired?.recommendation.length).toBeGreaterThan(10);
  });

  it("до конца срока 20 дней → ntls-expiring (warning)", async () => {
    const findings = await auditTls("example.com", {
      probe: async () => probeOk({ cert: { ...probeOk().cert!, validTo: certDate(20) } }),
    });
    const expiring = findings.find((f) => f.id === "ntls-expiring");
    expect(expiring).toBeDefined();
    expect(expiring?.severity).toBe("medium");
    expect(expiring?.evidence).toContain("20");
  });

  it("граница: 30 дней → warning, 31 день → чисто", async () => {
    const at30 = await auditTls("example.com", {
      probe: async () => probeOk({ cert: { ...probeOk().cert!, validTo: certDate(30) } }),
    });
    expect(at30.map((f) => f.id)).toContain("ntls-expiring");
    const at31 = await auditTls("example.com", {
      probe: async () => probeOk({ cert: { ...probeOk().cert!, validTo: certDate(31) } }),
    });
    expect(at31.map((f) => f.id)).not.toContain("ntls-expiring");
  });

  it("самоподписанный сертификат → ntls-self-signed (high)", async () => {
    const findings = await auditTls("example.com", {
      probe: async () =>
        probeOk({ authorized: false, authorizationError: "DEPTH_ZERO_SELF_SIGNED_CERT" }),
    });
    const selfSigned = findings.find((f) => f.id === "ntls-self-signed");
    expect(selfSigned).toBeDefined();
    expect(selfSigned?.severity).toBe("high");
  });

  it("имя сертификата не совпадает с хостом → ntls-name-mismatch (high)", async () => {
    const findings = await auditTls("example.com", {
      probe: async () =>
        probeOk({ cert: { ...probeOk().cert!, altNames: ["other.com"], subjectCN: "other.com" } }),
    });
    const mismatch = findings.find((f) => f.id === "ntls-name-mismatch");
    expect(mismatch).toBeDefined();
    expect(mismatch?.severity).toBe("high");
  });

  it("wildcard SAN покрывает поддомен — ложного срабатывания нет", async () => {
    const findings = await auditTls("api.example.com", {
      probe: async () =>
        probeOk({ cert: { ...probeOk().cert!, altNames: ["*.example.com"] } }),
    });
    expect(findings.map((f) => f.id)).not.toContain("ntls-name-mismatch");
  });

  it("сервер принимает TLS 1.1 → ntls-legacy-enabled (high), проверка идёт с maxVersion", async () => {
    const calls: Parameters<TlsProbeFn>[1][] = [];
    const probe: TlsProbeFn = async (_host, opts) => {
      calls.push(opts);
      if (opts.maxVersion === "TLSv1.1") {
        return { handshake: true, protocol: "TLSv1.1" };
      }
      return probeOk();
    };
    const findings = await auditTls("example.com", { probe });
    const legacy = findings.find((f) => f.id === "ntls-legacy-enabled");
    expect(legacy).toBeDefined();
    expect(legacy?.severity).toBe("high");
    expect(legacy?.evidence).toContain("TLSv1.1");
    expect(calls.some((c) => c.maxVersion === "TLSv1.1")).toBe(true);
  });

  it("рукопожатие не удалось → ntls-no-tls (high), legacy-проба не запускается", async () => {
    let probeCalls = 0;
    const findings = await auditTls("example.com", {
      probe: async () => {
        probeCalls += 1;
        return { handshake: false, error: "connect ECONNREFUSED 127.0.0.1:443" };
      },
    });
    expect(probeCalls).toBe(1);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe("ntls-no-tls");
    expect(findings[0].severity).toBe("high");
    expect(findings[0].evidence).toContain("ECONNREFUSED");
  });

  it("сервер согласовал TLSv1.1 основным рукопожатием → ntls-old-protocol (high)", async () => {
    const findings = await auditTls("example.com", {
      probe: async () => probeOk({ protocol: "TLSv1.1" }),
    });
    const old = findings.find((f) => f.id === "ntls-old-protocol");
    expect(old).toBeDefined();
    expect(old?.severity).toBe("high");
  });

  it("свежий сертификат, TLS 1.3, старые протоколы отвергаются → нет находок", async () => {
    const findings = await auditTls("example.com", {
      probe: async (_host, opts) =>
        opts.maxVersion === "TLSv1.1"
          ? { handshake: false, error: "no protocols available" }
          : probeOk(),
    });
    expect(findings).toEqual([]);
  });
});

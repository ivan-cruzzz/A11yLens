import { describe, expect, it, vi } from "vitest";
import {
  auditEmailSecurity,
  createTxtCache,
  type EmailDeps,
  type TxtResolver,
} from "../../src/engine/native/email";

/** DNS-двойник: отсутствующие имена «не резолвятся» (как ENODATA). */
const dnsWith = (records: Record<string, string[]>): EmailDeps => ({
  resolveTxt: async (name) => {
    const hit = records[name];
    if (!hit) {
      throw new Error(`queryTxt ENODATA ${name}`);
    }
    return hit;
  },
});

describe("auditEmailSecurity", () => {
  it("нет SPF → nmail-no-spf (medium)", async () => {
    const result = await auditEmailSecurity("example.com", dnsWith({}));
    const spf = result.findings.find((f) => f.id === "nmail-no-spf");
    expect(spf).toBeDefined();
    expect(spf?.severity).toBe("medium");
  });

  it("SPF с +all (можно подделать любого отправителя) → nmail-spf-all (high)", async () => {
    const result = await auditEmailSecurity(
      "example.com",
      dnsWith({ "example.com": ["v=spf1 ip4:203.0.113.0/24 +all"] })
    );
    const all = result.findings.find((f) => f.id === "nmail-spf-all");
    expect(all).toBeDefined();
    expect(all?.severity).toBe("high");
    expect(all?.evidence).toContain("+all");
  });

  it("корректный SPF (~all) — находок по SPF нет", async () => {
    const result = await auditEmailSecurity(
      "example.com",
      dnsWith({ "example.com": ["v=spf1 include:_spf.example.com ~all"] })
    );
    expect(result.findings.map((f) => f.id)).not.toContain("nmail-no-spf");
    expect(result.findings.map((f) => f.id)).not.toContain("nmail-spf-all");
  });

  it("нет DMARC → medium; p=none → low; p=reject → чисто", async () => {
    const none = await auditEmailSecurity("example.com", dnsWith({}));
    const noDmarc = none.findings.find((f) => f.id === "nmail-no-dmarc");
    expect(noDmarc).toBeDefined();
    expect(noDmarc?.severity).toBe("medium");

    const soft = await auditEmailSecurity(
      "example.com",
      dnsWith({
        "example.com": ["v=spf1 ~all"],
        "_dmarc.example.com": ["v=DMARC1; p=none; rua=mailto:dmarc@example.com"],
      })
    );
    const dmarcNone = soft.findings.find((f) => f.id === "nmail-dmarc-none");
    expect(dmarcNone).toBeDefined();
    expect(dmarcNone?.severity).toBe("low");

    const strict = await auditEmailSecurity(
      "example.com",
      dnsWith({
        "example.com": ["v=spf1 ~all"],
        "_dmarc.example.com": ["v=DMARC1; p=reject"],
        "google._domainkey.example.com": ["v=DKIM1; k=rsa; p=MIIBIjANBg"],
      })
    );
    expect(strict.findings).toEqual([]);
  });

  it("нет DKIM ни на одном типовом селекторе → nmail-no-dkim (low) с перечнем селекторов", async () => {
    const result = await auditEmailSecurity(
      "example.com",
      dnsWith({
        "example.com": ["v=spf1 ~all"],
        "_dmarc.example.com": ["v=DMARC1; p=quarantine"],
      })
    );
    const dkim = result.findings.find((f) => f.id === "nmail-no-dkim");
    expect(dkim).toBeDefined();
    expect(dkim?.severity).toBe("low");
    expect(dkim?.evidence).toContain("_domainkey");
  });

  it("сбой DNS одного имени не ломает аудит остальных", async () => {
    const resolveTxt: TxtResolver = async (name) => {
      if (name === "example.com") {
        throw new Error("SERVFAIL");
      }
      throw new Error("ENODATA");
    };
    const result = await auditEmailSecurity("example.com", { resolveTxt });
    expect(result.findings.map((f) => f.id)).toContain("nmail-no-spf");
    expect(result.findings.map((f) => f.id)).toContain("nmail-no-dmarc");
  });
});

describe("createTxtCache", () => {
  it("повторный запрос того же имени идёт из кеша — один вызов в DNS", async () => {
    const underlying = vi.fn<TxtResolver>(async () => ["v=spf1 ~all"]);
    const cache = createTxtCache(underlying);

    await cache.resolveTxt("example.com");
    await cache.resolveTxt("example.com");

    expect(underlying).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(1);
  });

  it("разные имена кешируются отдельно; сбой тоже кешируется на время скана", async () => {
    const underlying = vi.fn<TxtResolver>(async (name) => {
      if (name === "bad.example.com") {
        throw new Error("SERVFAIL");
      }
      return ["v=DMARC1; p=reject"];
    });
    const cache = createTxtCache(underlying);

    await cache.resolveTxt("_dmarc.example.com");
    await cache.resolveTxt("_dmarc.example.com");
    await expect(cache.resolveTxt("bad.example.com")).rejects.toThrow("SERVFAIL");
    await expect(cache.resolveTxt("bad.example.com")).rejects.toThrow("SERVFAIL");

    expect(underlying).toHaveBeenCalledTimes(2);
    expect(cache.size()).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  checkLibraryCves,
  type OsvFetch,
  type OsvResponseLite,
} from "../../src/engine/native/cve";
import type { LibraryInfo } from "../../src/engine/native";

const okJson = (payload: unknown): OsvResponseLite => ({
  ok: true,
  status: 200,
  json: async () => payload,
});

describe("checkLibraryCves", () => {
  it("уязвимая библиотека → finding с CVE-id, severity high и ссылкой на OSV", async () => {
    const calls: { url: string; body?: string }[] = [];
    const fetch: OsvFetch = async (url, init) => {
      calls.push({ url, body: init?.body });
      if (url.endsWith("/querybatch")) {
        return okJson({ results: [{ vulns: [{ id: "GHSA-j8xg-fqg3-53r7" }] }] });
      }
      return okJson({
        id: "GHSA-j8xg-fqg3-53r7",
        summary: "XSS in jQuery before 3.5.0",
        aliases: ["CVE-2020-11022"],
      });
    };

    const result = await checkLibraryCves([{ name: "jquery", version: "3.4.0" }], { fetch });

    expect(result.degradations).toEqual([]);
    const finding = result.findings.find((f) => f.id === "ncve-jquery");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("high");
    expect(finding?.detail).toContain("CVE-2020-11022");
    expect(finding?.recommendation).toContain("osv.dev/vulnerability/CVE-2020-11022");
    expect(finding?.evidence).toContain("GHSA-j8xg-fqg3-53r7");

    const batch = calls.find((c) => c.url.endsWith("/querybatch"));
    expect(batch).toBeDefined();
    const parsed = JSON.parse(batch!.body ?? "{}") as {
      queries: { package: { name: string; ecosystem: string }; version: string }[];
    };
    expect(parsed.queries[0].package.name).toBe("jquery");
    expect(parsed.queries[0].package.ecosystem).toBe("npm");
    expect(parsed.queries[0].version).toBe("3.4.0");
  });

  it("не-semver версия не отправляется в OSV", async () => {
    let calls = 0;
    const fetch: OsvFetch = async () => {
      calls += 1;
      return okJson({ results: [] });
    };
    const libraries: LibraryInfo[] = [{ name: "widget", version: "3.x" }];

    const result = await checkLibraryCves(libraries, { fetch });

    expect(calls).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it("OSV недоступен → деградация с пометкой и info-находка, не падение", async () => {
    const fetch: OsvFetch = async () => ({ ok: false, status: 503, json: async () => null });

    const result = await checkLibraryCves([{ name: "jquery", version: "3.4.0" }], { fetch });

    expect(result.degradations).toHaveLength(1);
    expect(result.degradations[0]).toContain("OSV");
    const marked = result.findings.find((f) => f.id === "ncve-osv-unavailable");
    expect(marked).toBeDefined();
    expect(marked?.severity).toBe("info");
  });

  it("сеть OSV упала с исключением → та же деградация, без throw", async () => {
    const fetch: OsvFetch = async () => {
      throw new Error("fetch failed");
    };
    const result = await checkLibraryCves([{ name: "react", version: "16.0.0" }], { fetch });
    expect(result.degradations).toHaveLength(1);
    expect(result.findings.map((f) => f.id)).toContain("ncve-osv-unavailable");
  });

  it("две уязвимые библиотеки → две находки; чистая библиотека находки не даёт", async () => {
    const fetch: OsvFetch = async (url) => {
      if (url.endsWith("/querybatch")) {
        return okJson({
          results: [{ vulns: [{ id: "GHSA-jquery" }] }, { vulns: [{ id: "GHSA-lodash" }] }, {}],
        });
      }
      if (url.includes("GHSA-jquery")) {
        return okJson({ id: "GHSA-jquery", aliases: ["CVE-2012-6708"] });
      }
      return okJson({ id: "GHSA-lodash", aliases: ["CVE-2019-10744"] });
    };

    const result = await checkLibraryCves(
      [
        { name: "jquery", version: "1.11.0" },
        { name: "lodash", version: "4.17.4" },
        { name: "moment", version: "2.29.4" },
      ],
      { fetch }
    );

    const ids = result.findings.map((f) => f.id).sort();
    expect(ids).toEqual(["ncve-jquery", "ncve-lodash"]);
    expect(result.findings.every((f) => f.severity === "high")).toBe(true);
  });
});

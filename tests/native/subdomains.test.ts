import { describe, expect, it, vi } from "vitest";
import {
  findSubdomains,
  type CrtShEntry,
  type HostResolver,
} from "../../src/engine/native/subdomains";

const crt = (entries: CrtShEntry[]) => async () => entries;

describe("findSubdomains", () => {
  it("crt.sh-записи нормализуются: дубли, wildcard, чужие домены, apex", async () => {
    const fetchCrtSh = crt([
      { name_value: "api.example.com\n*.example.com\nexample.com\nevil.com" },
      { common_name: "API.EXAMPLE.COM" },
      { name_value: "www.example.com" },
    ]);
    const resolve: HostResolver = async (host) => host === "api.example.com";

    const result = await findSubdomains("example.com", {}, { fetchCrtSh, resolve });

    expect(result.subdomains).toEqual(["api.example.com"]);
    // Единственный резолвящийся поддомен попадает в info-инвентарь.
    expect(result.findings.map((f) => f.id)).toEqual(["nsub-inventory"]);
    expect(result.findings[0].evidence).toContain("api.example.com");
  });

  it("резолвящиеся поддомены попадают в info-находку со списком", async () => {
    const fetchCrtSh = crt([{ name_value: "api.example.com\nstaging.example.com" }]);
    const resolve: HostResolver = async () => true;

    const result = await findSubdomains("example.com", {}, { fetchCrtSh, resolve });

    const inventory = result.findings.find((f) => f.id === "nsub-inventory");
    expect(inventory).toBeDefined();
    expect(inventory?.severity).toBe("info");
    expect(inventory?.evidence).toContain("api.example.com");
    expect(inventory?.evidence).toContain("staging.example.com");
    expect(result.subdomains).toEqual(["api.example.com", "staging.example.com"]);
  });

  it("crt.sh недоступен → деградация с пометкой, не падение", async () => {
    const fetchCrtSh = async () => {
      throw new Error("getaddrinfo ENOTFOUND crt.sh");
    };
    const resolve: HostResolver = async () => true;

    const result = await findSubdomains("example.com", {}, { fetchCrtSh, resolve });

    expect(result.degradations).toHaveLength(1);
    expect(result.degradations[0]).toContain("crt.sh");
    expect(result.findings).toEqual([]);
    expect(result.subdomains).toEqual([]);
  });

  it("лимит: DNS-резолв делается только для первых limit кандидатов", async () => {
    const entries: CrtShEntry[] = [
      {
        name_value: Array.from({ length: 10 }, (_, i) => `host${i}.example.com`).join("\n"),
      },
    ];
    const resolve = vi.fn<HostResolver>(async () => true);

    await findSubdomains("example.com", { limit: 3 }, { fetchCrtSh: crt(entries), resolve });

    expect(resolve).toHaveBeenCalledTimes(3);
  });
});

import { describe, expect, it } from "vitest";
import {
  TOP_PORTS,
  scanPorts,
  type PortProbeFn,
} from "../../src/engine/native/ports";

describe("TOP_PORTS", () => {
  it("реестр топ-портов: ровно 100 уникальных портов", () => {
    expect(TOP_PORTS).toHaveLength(100);
    expect(new Set(TOP_PORTS).size).toBe(100);
  });
});

describe("scanPorts", () => {
  const smallPorts = [21, 80, 443, 445, 3389, 3306];

  it("открытые опасные порты → находки с критичностью и рецептом", async () => {
    const probe: PortProbeFn = async (_host, port) => port === 445 || port === 3389;
    const result = await scanPorts("example.com", { ports: smallPorts }, { probe });

    const smb = result.findings.find((f) => f.id === "nport-445");
    const rdp = result.findings.find((f) => f.id === "nport-3389");
    expect(smb).toBeDefined();
    expect(rdp).toBeDefined();
    expect(smb?.severity).toBe("high");
    expect(rdp?.severity).toBe("high");
    expect(smb?.recommendation.length).toBeGreaterThan(10);
    expect(result.openPorts).toEqual([445, 3389]);
  });

  it("открытые обычные порты (80/443) → одна info-находка со списком", async () => {
    const probe: PortProbeFn = async (_host, port) => port === 80 || port === 443;
    const result = await scanPorts("example.com", { ports: smallPorts }, { probe });

    expect(result.openPorts).toEqual([80, 443]);
    const summary = result.findings.find((f) => f.id === "nports-open");
    expect(summary).toBeDefined();
    expect(summary?.severity).toBe("info");
    expect(summary?.evidence).toContain("80");
    expect(summary?.evidence).toContain("443");
  });

  it("все порты закрыты → находок нет", async () => {
    const probe: PortProbeFn = async () => false;
    const result = await scanPorts("example.com", { ports: smallPorts }, { probe });
    expect(result.openPorts).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it("зависшие пробы не блокируют скан: бюджет и таймаут дают «не проверено»", async () => {
    const probe: PortProbeFn = () => new Promise<boolean>(() => undefined);
    const started = Date.now();
    const result = await scanPorts(
      "example.com",
      { ports: smallPorts, timeoutMsPerPort: 50, totalBudgetMs: 1000 },
      { probe }
    );
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.openPorts).toEqual([]);
    expect(result.uncheckedPorts).toBe(smallPorts.length);
  });

  it("100 портов опрашиваются параллельно, а не по очереди", async () => {
    let active = 0;
    let maxActive = 0;
    const probe: PortProbeFn = async (_host, port) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return port === 8080;
    };
    const result = await scanPorts("example.com", {}, { probe });

    expect(result.probedCount).toBe(100);
    expect(maxActive).toBeGreaterThan(10);
    expect(result.openPorts).toEqual([8080]);
  });
});

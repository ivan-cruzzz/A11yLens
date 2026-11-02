import { beforeEach, describe, expect, it, vi } from "vitest";
import { promises as dns } from "node:dns";
import { assertPublicHttpUrl, normalizeUrl } from "../src/engine";

vi.mock("node:dns", () => ({
  promises: { lookup: vi.fn() },
}));

const lookup = dns.lookup as unknown as ReturnType<typeof vi.fn>;

describe("normalizeUrl — нормализация", () => {
  it("добавляет https:// к голому домену", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });

  it("сохраняет путь и query, тримит пробелы", () => {
    expect(normalizeUrl("  example.com/a?b=1  ")).toBe(
      "https://example.com/a?b=1"
    );
  });

  it("явный http сохраняется", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
  });
});

describe("normalizeUrl — блокировка внутренних адресов", () => {
  const blocked = [
    "localhost",
    "localhost:3000",
    "sub.localhost",
    "printer.local",
    "127.0.0.1",
    "127.1",
    "0.0.0.0",
    "10.0.0.5",
    "192.168.1.1",
    "172.16.0.1",
    "172.31.255.255",
    // link-local / метаданные облачных провайдеров
    "169.254.169.254",
    "169.254.0.1",
    "metadata.google.internal",
    "metadata.goog",
    // десятичная / восьмеричная / шестнадцатеричная запись IP
    "2130706433",
    "0177.0.0.1",
    "0x7f.0.0.1",
    "0x7f000001",
    "3232235521",
    // IPv6: loopback, link-local, ULA, v4-mapped
    "[::1]",
    "[fe80::1]",
    "[fd00::1]",
    "[::ffff:127.0.0.1]",
  ];

  it.each(blocked)("отклоняет %s", (raw) => {
    expect(() => normalizeUrl(raw)).toThrow(/Внутренние адреса/);
  });

  const allowed = [
    "example.com",
    "sub.example.com",
    "https://8.8.8.8",
    "[2606:4700::1111]",
    "172.32.0.1",
  ];

  it.each(allowed)("принимает %s", (raw) => {
    expect(() => normalizeUrl(raw)).not.toThrow();
  });

  it("пустой адрес → понятная ошибка", () => {
    expect(() => normalizeUrl("   ")).toThrow("Укажите адрес страницы");
  });

  it("не-http протоколы отклонены", () => {
    expect(() => normalizeUrl("ftp://example.com")).toThrow(
      "Поддерживаются только http и https"
    );
    expect(() => normalizeUrl("file:///etc/passwd")).toThrow();
  });
});

describe("assertPublicHttpUrl — DNS-резолв", () => {
  beforeEach(() => {
    lookup.mockReset();
  });

  it("публичный IP → проходит", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(
      assertPublicHttpUrl("https://example.com/")
    ).resolves.toBeUndefined();
  });

  it("домен, резолвящийся в приватный IP, отклонён (DNS rebinding)", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    await expect(
      assertPublicHttpUrl("https://rebind.example.com/")
    ).rejects.toThrow(/Внутренние адреса/);
  });

  it("хотя бы один приватный адрес из нескольких → отклонён", async () => {
    lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.0.2", family: 4 },
    ]);
    await expect(
      assertPublicHttpUrl("https://example.com/")
    ).rejects.toThrow(/Внутренние адреса/);
  });

  it("резолв в link-local (метаданные облака) → отклонён", async () => {
    lookup.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    await expect(
      assertPublicHttpUrl("https://example.com/")
    ).rejects.toThrow(/Внутренние адреса/);
  });

  it("резолв в частный IPv6 → отклонён", async () => {
    lookup.mockResolvedValue([{ address: "fd12::5", family: 6 }]);
    await expect(
      assertPublicHttpUrl("https://example.com/")
    ).rejects.toThrow(/Внутренние адреса/);
  });

  it("DNS не смог найти домен → дружелюбная ошибка, а не сырой ENOTFOUND", async () => {
    lookup.mockRejectedValue(new Error("getaddrinfo ENOTFOUND nope.invalid"));
    await expect(
      assertPublicHttpUrl("https://nope.invalid/")
    ).rejects.toThrow("Сайт не открылся");
  });
});

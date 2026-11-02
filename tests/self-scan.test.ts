import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SECURITY_CHECKS, runScan, type ScanResult } from "../src/engine";

/**
 * Smoke-тест движка целиком: npm run scan:self.
 * Поднимает локальную страницу с подложенными нарушениями
 * и прогоняет по ней настоящий runScan (Playwright + axe).
 * Сети нет: и страница, и пробы остаются на 127.0.0.1.
 */

const FIXTURE_URL = new URL("./fixtures/self-scan.html", import.meta.url);

describe("self-scan: локальная фикстурная страница", () => {
  let server: Server;
  let baseUrl: string;
  let result: ScanResult;

  beforeAll(async () => {
    const html = await readFile(fileURLToPath(FIXTURE_URL), "utf8");
    server = createServer((req, res) => {
      if (!req.url || req.url === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}/`;

    result = await runScan({
      url: baseUrl,
      standard: "AA",
      device: "desktop",
      allowPrivateNetwork: true,
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("находит подложенные нарушения доступности", () => {
    const ids = result.violations.map((v) => v.id);
    expect(ids).toContain("html-has-lang");
    expect(ids).toContain("image-alt");
    expect(ids).toContain("button-name");
    expect(ids).toContain("link-name");
    expect(result.score).toBeLessThan(100);
    expect(result.totalViolations).toBeGreaterThan(0);
  });

  it("security-аудит прошёл по реестру и увидел отсутствие заголовков", () => {
    expect(result.security?.error).toBeUndefined();
    expect(result.security?.checksRun).toBe(SECURITY_CHECKS.length);
    const secIds = (result.security?.findings ?? []).map((f) => f.id);
    expect(secIds).toContain("sec-csp");
    expect(secIds).toContain("sec-hsts");
    // Фикстура отвечает 404 на все пути проб — ложных срабатываний нет.
    expect(secIds).not.toContain("sec-git-exposed");
    expect(secIds).not.toContain("sec-env-exposed");
    // auditHttpsRedirect пробует порт 80 хоста, а фикстура на случайном
    // порту — проверка честно считает HTTP недоступным, без находки.
    expect(secIds).not.toContain("sec-https-redirect");
  });

  it("без allowPrivateNetwork локальный адрес отклоняет SSRF-фильтром", async () => {
    await expect(
      runScan({ url: baseUrl, standard: "AA", device: "desktop" })
    ).rejects.toThrow(/Внутренние адреса/);
  });
});

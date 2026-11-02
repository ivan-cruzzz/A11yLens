import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SECURITY_CHECKS,
  auditCookies,
  auditHeaders,
  auditHttpsRedirect,
  auditMixedContent,
  auditSri,
  auditVersionDisclosure,
  buildSecurityAudit,
  computeSecurityScore,
  failedSecurityAudit,
  probeSensitiveFiles,
} from "../src/engine";
import insecureHeaders from "./fixtures/headers-insecure.json";
import secureHeaders from "./fixtures/headers-secure.json";

const ids = (findings: { id: string }[]) => findings.map((f) => f.id);

/** Минимальный Response-двойник для сетевых проверок. */
const fakeResponse = (
  status: number,
  body = "",
  headers: Record<string, string> = {}
) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    text: async () => body,
  }) as unknown as Response;

const stubFetch = (
  handler: (
    url: string,
    init?: Parameters<typeof fetch>[1]
  ) => Response | Promise<Response>
) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      return handler(url, init);
    })
  );
};

const PROBE_BODIES: Record<string, string> = {
  "/.git/HEAD": "ref: refs/heads/main\n",
  "/.env": "DB_PASSWORD=topsecret\nAPP_ENV=prod\n",
  "/phpinfo.php": "<h1>phpinfo()</h1><p>PHP Version 8.2.0</p>",
  "/wp-config.php.bak": "define('DB_PASSWORD','x'); define('DB_HOST','localhost');",
  "/.DS_Store": "\u0000\u0000\u0000\u0001Bud1\u0000\u0000",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auditHeaders", () => {
  it("без защитных заголовков → 7 находок в фиксированном порядке", () => {
    expect(ids(auditHeaders(insecureHeaders))).toEqual([
      "sec-csp",
      "sec-hsts",
      "sec-clickjacking",
      "sec-nosniff",
      "sec-referrer",
      "sec-permissions",
      "sec-coop",
    ]);
  });

  it("полный набор заголовков → чисто", () => {
    expect(auditHeaders(secureHeaders)).toEqual([]);
  });

  it("CSP с frame-ancestors закрывает clickjacking и без X-Frame-Options", () => {
    const rest = { ...secureHeaders } as Record<string, string>;
    delete rest["x-frame-options"];
    expect(ids(auditHeaders(rest))).not.toContain("sec-clickjacking");
  });
});

describe("auditCookies", () => {
  it("куки без флагов → 3 находки", () => {
    expect(
      ids(
        auditCookies([
          { name: "sid", secure: false, httpOnly: false, sameSite: "" },
        ])
      )
    ).toEqual(["sec-cookie-secure", "sec-cookie-httponly", "sec-cookie-samesite"]);
  });

  it("кука со всеми флагами → чисто", () => {
    expect(
      auditCookies([
        { name: "sid", secure: true, httpOnly: true, sameSite: "Lax" },
      ])
    ).toEqual([]);
  });

  it("SameSite=None считается небезопасным", () => {
    expect(
      ids(
        auditCookies([
          { name: "sid", secure: true, httpOnly: true, sameSite: "None" },
        ])
      )
    ).toEqual(["sec-cookie-samesite"]);
  });
});

describe("auditMixedContent", () => {
  it("http-ресурсы на https-странице → находка high", () => {
    const findings = auditMixedContent(true, ["http://cdn.example.com/a.js"]);
    expect(ids(findings)).toEqual(["sec-mixed-content"]);
    expect(findings[0].severity).toBe("high");
  });

  it("http-страница → не проверяется", () => {
    expect(auditMixedContent(false, ["http://cdn.example.com/a.js"])).toEqual(
      []
    );
  });

  it("нет небезопасных ресурсов → чисто", () => {
    expect(auditMixedContent(true, [])).toEqual([]);
  });
});

describe("auditSri", () => {
  it("внешний скрипт без integrity → находка", () => {
    expect(
      ids(
        auditSri([{ src: "https://cdn.example.com/a.js", hasIntegrity: false }])
      )
    ).toEqual(["sec-sri"]);
  });

  it("скрипт с integrity → чисто", () => {
    expect(
      auditSri([{ src: "https://cdn.example.com/a.js", hasIntegrity: true }])
    ).toEqual([]);
  });
});

describe("auditVersionDisclosure", () => {
  it("X-Powered-By + generator + старый jQuery → 3 находки, jQuery medium", () => {
    const findings = auditVersionDisclosure({
      poweredBy: "Express",
      generator: "WordPress 6.4",
      jqueryVersion: "3.4.1",
    });
    expect(ids(findings)).toEqual([
      "sec-version-disclosure",
      "sec-jquery-version",
    ]);
    const jquery = findings.find((f) => f.id === "sec-jquery-version");
    expect(jquery?.severity).toBe("medium");
    expect(jquery?.title).toContain("Устаревший");
  });

  it("современный jQuery → только info-находка о раскрытии версии", () => {
    const findings = auditVersionDisclosure({ jqueryVersion: "3.7.1" });
    expect(ids(findings)).toEqual(["sec-jquery-version"]);
    expect(findings[0].severity).toBe("info");
  });

  it("пустой ввод → чисто", () => {
    expect(auditVersionDisclosure({})).toEqual([]);
  });
});

describe("auditHttpsRedirect", () => {
  it("301 на https → чисто", async () => {
    stubFetch(() => fakeResponse(301, "", { location: "https://example.com/" }));
    expect(await auditHttpsRedirect("example.com")).toEqual([]);
  });

  it("200 без редиректа → находка sec-https-redirect", async () => {
    stubFetch(() => fakeResponse(200, "<html></html>"));
    expect(ids(await auditHttpsRedirect("example.com"))).toEqual([
      "sec-https-redirect",
    ]);
  });

  it("301 на http (не https) → находка", async () => {
    stubFetch(() => fakeResponse(301, "", { location: "http://example.com/" }));
    expect(ids(await auditHttpsRedirect("example.com"))).toEqual([
      "sec-https-redirect",
    ]);
  });

  it("HTTP-порт недоступен (ошибка сети) → чисто, без throw", async () => {
    stubFetch(() => Promise.reject(new Error("ECONNREFUSED")));
    expect(await auditHttpsRedirect("example.com")).toEqual([]);
  });
});

describe("probeSensitiveFiles", () => {
  it("каждый чувствительный файл отвечает 200 с ожидаемым содержимым → 5 находок", async () => {
    stubFetch((url) => {
      const path = new URL(url).pathname;
      return fakeResponse(200, PROBE_BODIES[path] ?? "");
    });
    expect(
      ids(await probeSensitiveFiles("http://example.com"))
    ).toEqual([
      "sec-git-exposed",
      "sec-env-exposed",
      "sec-phpinfo",
      "sec-backup-config",
      "sec-dsstore",
    ]);
  });

  it("SPA-фолбэк: 200 с index.html на любой путь → ни одной находки", async () => {
    stubFetch(() =>
      fakeResponse(
        200,
        "<!doctype html><html><body><div id=root></div></body></html>"
      )
    );
    expect(await probeSensitiveFiles("http://example.com")).toEqual([]);
  });

  it("404 на всех путях → чисто", async () => {
    stubFetch(() => fakeResponse(404, "not found"));
    expect(await probeSensitiveFiles("http://example.com")).toEqual([]);
  });

  it("сетевая ошибка пробы не роняет аудит", async () => {
    stubFetch(() => Promise.reject(new Error("ETIMEDOUT")));
    expect(await probeSensitiveFiles("http://example.com")).toEqual([]);
  });

  it("302-редирект пробы не даёт находку: redirect manual, 3xx — проба не удалась", async () => {
    stubFetch((url, init) => {
      if (new URL(url).pathname !== "/.env") {
        return fakeResponse(404, "");
      }
      // Настоящий fetch с redirect:"follow" сам дошёл бы до цели редиректа
      // и отдал бы её тело; с "manual" возвращает сам 302. Двойник
      // воспроизводит оба режима, как делает реальный fetch.
      if (init?.redirect === "manual") {
        return fakeResponse(302, "", {
          location: "http://169.254.169.254/latest/meta-data/",
        });
      }
      return fakeResponse(200, "DB_PASSWORD=leaked-through-redirect");
    });
    expect(ids(await probeSensitiveFiles("http://example.com"))).toEqual([]);
  });

  it("пробы идут параллельно: 5 проб по 40 мс укладываются быстрее 120 мс", async () => {
    const delay = 40;
    stubFetch(async (url) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      const path = new URL(url).pathname;
      return fakeResponse(200, PROBE_BODIES[path] ?? "");
    });
    const startedAt = Date.now();
    const findings = await probeSensitiveFiles("http://example.com");
    const elapsed = Date.now() - startedAt;
    expect(findings).toHaveLength(5);
    // Последовательно было бы ≥ 5×40 = 200 мс; параллельно — ~40 мс.
    expect(elapsed).toBeLessThan(delay * 3);
  });
});

describe("SECURITY_CHECKS — реестр проверок", () => {
  it("идентификаторы уникальны", () => {
    const all = SECURITY_CHECKS.map((check) => check.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("в реестре 20 проверок (все уникальные sec-* находки)", () => {
    expect(SECURITY_CHECKS.length).toBe(20);
  });

  it("каждая проверка реестра даёт находку на позитивной фикстуре", async () => {
    stubFetch((url) => {
      const path = new URL(url).pathname;
      if (path === "/") {
        return fakeResponse(200, "<html></html>");
      }
      return fakeResponse(200, PROBE_BODIES[path] ?? "");
    });
    const produced = new Set<string>([
      ...ids(auditHeaders(insecureHeaders)),
      ...ids(
        auditCookies([
          { name: "sid", secure: false, httpOnly: false, sameSite: "" },
        ])
      ),
      ...ids(auditMixedContent(true, ["http://cdn.example.com/a.js"])),
      ...ids(
        auditSri([{ src: "https://cdn.example.com/a.js", hasIntegrity: false }])
      ),
      ...ids(
        auditVersionDisclosure({
          poweredBy: "Express",
          generator: "WordPress 6.4",
          jqueryVersion: "3.4.1",
        })
      ),
      ...ids(await auditHttpsRedirect("example.com")),
      ...ids(await probeSensitiveFiles("http://example.com")),
    ]);
    const missing = SECURITY_CHECKS.filter((check) => !produced.has(check.id));
    expect(missing).toEqual([]);
  });
});

describe("buildSecurityAudit", () => {
  it("сортирует high→info и считает скор по весам", () => {
    const mk = (id: string, severity: "high" | "medium" | "low" | "info") => ({
      id,
      title: id,
      severity,
      detail: "d",
      recommendation: "r",
    });
    const audit = buildSecurityAudit([
      mk("c", "low"),
      mk("a", "high"),
      mk("d", "info"),
      mk("b", "medium"),
    ]);
    expect(audit.findings.map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
    expect(audit.score).toBe(100 - 20 - 10 - 5);
  });

  it("checksRun вычисляется из реестра, а не захардкожен", () => {
    expect(buildSecurityAudit([]).checksRun).toBe(SECURITY_CHECKS.length);
  });

  it("скор согласован с computeSecurityScore", () => {
    const findings = [
      {
        id: "x",
        title: "x",
        severity: "high" as const,
        detail: "d",
        recommendation: "r",
      },
    ];
    expect(buildSecurityAudit(findings).score).toBe(
      computeSecurityScore(findings)
    );
  });
});

describe("failedSecurityAudit", () => {
  it("сбой аудита → объект с ошибкой, а не undefined", () => {
    const audit = failedSecurityAudit("аудит упал на этапе сбора кук");
    expect(audit.score).toBe(0);
    expect(audit.findings).toEqual([]);
    expect(audit.checksRun).toBe(0);
    expect(audit.error).toContain("аудит упал");
  });
});

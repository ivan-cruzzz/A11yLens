import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_PAGES,
  aggregatePages,
  attachEvidence,
  clampMaxPages,
  pickInternalLinks,
  redactBody,
  withFetchRecorder,
  type EvidenceContext,
  type PageScanResult,
} from "../../src/engine/scan";
import type { SecurityFinding, Violation } from "../../src/engine/types";
import { auditHeaders } from "../../src/engine";

// ── Лимит страниц ────────────────────────────────────────────────────────────

describe("clampMaxPages", () => {
  it("по умолчанию 4 страницы", () => {
    expect(DEFAULT_MAX_PAGES).toBe(4);
    expect(clampMaxPages(undefined)).toBe(4);
  });
  it("число из диапазона проходит как есть", () => {
    expect(clampMaxPages(1)).toBe(1);
    expect(clampMaxPages(7)).toBe(7);
  });
  it("выход за границы обрезается", () => {
    expect(clampMaxPages(0)).toBe(1);
    expect(clampMaxPages(-3)).toBe(1);
    expect(clampMaxPages(99)).toBe(10);
  });
  it("не-число и NaN дают дефолт", () => {
    expect(clampMaxPages("5" as unknown as number)).toBe(4);
    expect(clampMaxPages(Number.NaN)).toBe(4);
  });
});

// ── Выбор внутренних ссылок ──────────────────────────────────────────────────

describe("pickInternalLinks", () => {
  const base = "https://example.com/";

  it("берёт только http(s)-ссылки того же хоста", () => {
    const links = pickInternalLinks(
      [
        "https://example.com/about",
        "https://other.com/page",
        "mailto:hi@example.com",
        "tel:+70000000000",
        "javascript:void(0)",
        "/docs",
        "../relative",
      ],
      base,
      10
    );
    expect(links).toEqual([
      "https://example.com/about",
      "https://example.com/docs",
      "https://example.com/relative",
    ]);
  });

  it("якоря схлопываются, дубликаты убираются, порядок из DOM сохраняется", () => {
    const links = pickInternalLinks(
      [
        "https://example.com/page#top",
        "/page",
        "https://example.com/page?q=1#foot",
      ],
      base,
      10
    );
    expect(links).toEqual([
      "https://example.com/page",
      "https://example.com/page?q=1",
    ]);
  });

  it("сама база не попадает в список", () => {
    expect(pickInternalLinks(["https://example.com/", "/", "#main"], base, 5)).toEqual(
      []
    );
  });

  it("лимит соблюдается", () => {
    const links = pickInternalLinks(
      ["/1", "/2", "/3", "/4", "/5"],
      base,
      3
    );
    expect(links).toHaveLength(3);
  });

  it("поддомен чужого хоста не проходит", () => {
    expect(
      pickInternalLinks(["https://cdn.example.com/x"], base, 5)
    ).toEqual([]);
  });

  it("битые URL молча пропускаются", () => {
    expect(
      pickInternalLinks(["http://", "http://%zz", "/ok"], base, 5)
    ).toEqual(["https://example.com/ok"]);
  });

  it("файлы-не-страницы (pdf, картинки) не попадают в обход", () => {
    const links = pickInternalLinks(
      ["/price.pdf", "/logo.png", "/blog", "/archive.zip"],
      base,
      10
    );
    expect(links).toEqual(["https://example.com/blog"]);
  });

  it("нулевая лимита — пустой список", () => {
    expect(pickInternalLinks(["/x"], base, 0)).toEqual([]);
  });
});

// ── Сборка мультистраничного отчёта ──────────────────────────────────────────

const pageViolation = (id: string, impact: Violation["impact"], nodes = 1): Violation => ({
  id,
  title: id,
  help: id,
  helpUrl: `https://deque/${id}`,
  impact,
  category: "other",
  tags: [],
  nodes: Array.from({ length: nodes }, (_, i) => ({
    selector: `#n${i}`,
    snippet: "<i>",
  })),
});

const pageResult = (
  url: string,
  violations: Violation[],
  extra: Partial<PageScanResult> = {}
): PageScanResult => ({
  url,
  title: `t-${url}`,
  isMain: false,
  loadMs: 100,
  passedRules: 40,
  incompleteRules: 0,
  violations,
  ...extra,
});

describe("aggregatePages", () => {
  it("каждому нарушению проставляется его страница, страницы суммируются", () => {
    const report = aggregatePages([
      pageResult("https://x.com/", [pageViolation("v-main", "critical")], {
        isMain: true,
      }),
      pageResult("https://x.com/about", [pageViolation("v-about", "minor")]),
    ]);
    expect(report.violations.find((v) => v.id === "v-main")?.pageUrl).toBe(
      "https://x.com/"
    );
    expect(report.violations.find((v) => v.id === "v-about")?.pageUrl).toBe(
      "https://x.com/about"
    );
    expect(report.pages).toEqual([
      {
        url: "https://x.com/",
        title: "t-https://x.com/",
        isMain: true,
        violations: 1,
        loadMs: 100,
      },
      {
        url: "https://x.com/about",
        title: "t-https://x.com/about",
        isMain: false,
        violations: 1,
        loadMs: 100,
      },
    ]);
  });

  it("нарушения отсортированы по критичности поверх страниц", () => {
    const report = aggregatePages([
      pageResult("https://x.com/", [pageViolation("b", "minor")], { isMain: true }),
      pageResult("https://x.com/about", [pageViolation("a", "critical")]),
    ]);
    expect(report.violations.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("counts, totalNodes и правила метаданных суммируются по всем страницам", () => {
    const report = aggregatePages([
      pageResult(
        "https://x.com/",
        [pageViolation("m1", "critical", 3), pageViolation("m2", "moderate", 1)],
        { isMain: true, passedRules: 10 }
      ),
      pageResult("https://x.com/about", [pageViolation("s1", "minor", 2)], {
        passedRules: 5,
        incompleteRules: 2,
      }),
    ]);
    expect(report.counts.other).toBe(3);
    // max(nodes,1): 3 + 1 + 2
    expect(report.totalNodes).toBe(6);
    // rulesRun = (10 + 2) + (5 + 1) = 18
    expect(report.rulesRun).toBe(18);
    expect(report.passedRules).toBe(15);
    expect(report.incompleteRules).toBe(2);
  });

  it("скор по объединённым нарушениям сходится с ручным расчётом по весам", () => {
    const report = aggregatePages([
      pageResult("https://x.com/", [pageViolation("m1", "critical", 3)], {
        isMain: true,
      }),
    ]);
    // 100 − 12·3 = 64
    expect(report.score).toBe(64);
  });
});

// ── Доказательства находок (evidence) ────────────────────────────────────────

const INSECURE_HEADERS = {
  server: "nginx",
  "content-type": "text/html",
};

const baseContext = (over: Partial<EvidenceContext> = {}): EvidenceContext => ({
  headers: INSECURE_HEADERS,
  cookies: [],
  insecureResources: [],
  externals: [],
  poweredBy: undefined,
  generator: undefined,
  jqueryVersion: undefined,
  fetchLog: [],
  ...over,
});

describe("attachEvidence", () => {
  it("каждая находка получает непустое evidence", () => {
    const findings = [
      ...auditHeaders(INSECURE_HEADERS),
      {
        id: "sec-https-redirect",
        title: "t",
        severity: "medium",
        detail: "Запрос http://example.com/ вернул 200 без редиректа на HTTPS.",
        recommendation: "r",
      },
    ] as SecurityFinding[];
    const withEvidence = attachEvidence(findings, baseContext());
    expect(withEvidence).toHaveLength(findings.length);
    for (const finding of withEvidence) {
      expect(
        finding.evidence?.length ?? 0,
        `нет evidence у ${finding.id}`
      ).toBeGreaterThan(5);
    }
  });

  it("evidence для cookie-находки называет конкретную куку и её флаги", () => {
    const findings = [
      {
        id: "sec-cookie-secure",
        title: "t",
        severity: "medium",
        detail: "d",
        recommendation: "r",
      } as SecurityFinding,
    ];
    const withEvidence = attachEvidence(
      findings,
      baseContext({
        cookies: [{ name: "sid", secure: false, httpOnly: true, sameSite: "Lax" }],
      })
    );
    expect(withEvidence[0].evidence).toContain("sid");
    expect(withEvidence[0].evidence).toContain("Secure");
  });

  it("evidence для probe-находки берёт статус и фрагмент из журнала fetch", () => {
    const findings = [
      {
        id: "sec-env-exposed",
        title: "Доступен .env",
        severity: "high",
        detail: "d",
        recommendation: "r",
      } as SecurityFinding,
    ];
    const withEvidence = attachEvidence(
      findings,
      baseContext({
        fetchLog: [
          {
            url: "https://x.com/.env",
            status: 200,
            bodyHead: "APP_ENV=prod\nDB_PASSWORD=s3cr3t",
          },
        ],
      })
    );
    expect(withEvidence[0].evidence).toContain("200");
    expect(withEvidence[0].evidence).toContain("DB_PASSWORD");
    // Секретные значения маскируются в доказательстве.
    expect(withEvidence[0].evidence).not.toContain("s3cr3t");
  });

  it("redactBody маскирует KEY=VALUE, но оставляет обычный текст", () => {
    const redacted = redactBody("ref: refs/heads/main\nAPP_KEY=abcd1234");
    expect(redacted).toContain("ref: refs/heads/main");
    expect(redacted).toContain("APP_KEY=***");
    expect(redacted).not.toContain("abcd1234");
  });

  it("evidence для mixed content перечисляет конкретные http-ресурсы", () => {
    const findings = [
      {
        id: "sec-mixed-content",
        title: "t",
        severity: "high",
        detail: "d",
        recommendation: "r",
      } as SecurityFinding,
    ];
    const withEvidence = attachEvidence(
      findings,
      baseContext({
        insecureResources: ["http://x.com/old.js", "http://x.com/pic.gif"],
      })
    );
    expect(withEvidence[0].evidence).toContain("http://x.com/old.js");
  });

  it("evidence для version disclosure содержит сырое значение заголовка", () => {
    const findings = [
      {
        id: "sec-version-disclosure",
        title: "t",
        severity: "low",
        detail: "d",
        recommendation: "r",
      } as SecurityFinding,
    ];
    const withEvidence = attachEvidence(
      findings,
      baseContext({ poweredBy: "Express" })
    );
    expect(withEvidence[0].evidence).toContain("Express");
  });
});

// ── Журналирование fetch для доказательств ───────────────────────────────────

describe("withFetchRecorder", () => {
  it("записывает статус и фрагмент тела и восстанавливает fetch после себя", async () => {
    const originalFetch = globalThis.fetch;
    const { value, log } = await withFetchRecorder(
      (url) => url.startsWith("data:"),
      async () => {
        const response = await fetch("data:text/plain,probe-body");
        return response.text();
      }
    );
    expect(value).toBe("probe-body");
    expect(log).toHaveLength(1);
    expect(log[0].status).toBe(200);
    expect(log[0].bodyHead).toContain("probe-body");
    expect(globalThis.fetch).toBe(originalFetch);
  });
});

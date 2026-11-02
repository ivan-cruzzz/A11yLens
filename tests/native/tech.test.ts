import { describe, expect, it } from "vitest";
import { detectTechnologies } from "../../src/engine/native/tech";

describe("detectTechnologies", () => {
  it("jQuery распознаётся с версией из src скрипта", () => {
    const html = '<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>';
    const tech = detectTechnologies({ html });
    const jquery = tech.find((t) => t.name === "jQuery");
    expect(jquery).toBeDefined();
    expect(jquery?.version).toBe("3.6.0");
    expect(jquery?.category).toBe("library");
  });

  it("Next.js распознаётся по /_next/ (без версии)", () => {
    const html = '<script src="/_next/static/chunks/main.js"></script>';
    const tech = detectTechnologies({ html });
    const next = tech.find((t) => t.name === "Next.js");
    expect(next).toBeDefined();
    expect(next?.category).toBe("framework");
  });

  it("WordPress: по wp-content, версия из meta generator", () => {
    const html =
      '<meta name="generator" content="WordPress 6.4.2"><link href="/wp-content/themes/a/style.css">';
    const tech = detectTechnologies({ html });
    const wp = tech.find((t) => t.name === "WordPress");
    expect(wp).toBeDefined();
    expect(wp?.category).toBe("cms");
    expect(wp?.version).toBe("6.4.2");
  });

  it("аналитика: Google Analytics и Яндекс Метрика", () => {
    const html =
      '<script src="https://www.googletagmanager.com/gtag/js?id=G-ABC"></script>' +
      '<script src="https://mc.yandex.ru/watch/12345"></script>';
    const tech = detectTechnologies({ html });
    expect(tech.find((t) => t.name === "Google Analytics")?.category).toBe("analytics");
    expect(tech.find((t) => t.name === "Яндекс Метрика")?.category).toBe("analytics");
  });

  it("React с версией из unpkg и Angular по ng-version", () => {
    const html =
      '<script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>' +
      '<html ng-version="17.0.0">';
    const tech = detectTechnologies({ html });
    const react = tech.find((t) => t.name === "React");
    expect(react?.version).toBe("18.2.0");
    const angular = tech.find((t) => t.name === "Angular");
    expect(angular?.version).toBe("17.0.0");
    expect(angular?.category).toBe("framework");
  });

  it("серверные технологии из заголовков: X-Powered-By и Server", () => {
    const tech = detectTechnologies({
      html: "",
      headers: { "x-powered-by": "Express", server: "nginx/1.24.0" },
    });
    expect(tech.find((t) => t.name === "Express")?.category).toBe("server");
    const nginx = tech.find((t) => t.name === "nginx");
    expect(nginx?.version).toBe("1.24.0");
  });

  it("1С-Битрикс по /bitrix/", () => {
    const tech = detectTechnologies({ html: '<script src="/bitrix/js/main/core.js">' });
    const bitrix = tech.find((t) => t.name === "1С-Битрикс");
    expect(bitrix?.category).toBe("cms");
  });

  it("ничего не распознано → пустой список", () => {
    expect(detectTechnologies({ html: "<p>Привет</p>" })).toEqual([]);
  });

  it("дубликаты схлопываются: два jQuery-скрипта → одна запись", () => {
    const html =
      '<script src="/js/jquery-3.6.0.min.js"></script><script src="/js/jquery-3.6.0.js"></script>';
    const tech = detectTechnologies({ html });
    expect(tech.filter((t) => t.name === "jQuery")).toHaveLength(1);
  });
});

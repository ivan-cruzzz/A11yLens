/**
 * Инвентарь технологий страницы (A01): фреймворк, CMS, библиотеки,
 * аналитика, сервер. Чистая функция над HTML и заголовками — без сети
 * и без выполнения скриптов. Версии, где распознаны, отдаются в CVE-проверку.
 */

import type { TechCategory, Technology } from "./types";

export interface TechDetectInput {
  html: string;
  headers?: Record<string, string>;
  url?: string;
}

interface HtmlRule {
  name: string;
  category: TechCategory;
  /** Версию достаём первой группой, если паттерн её захватывает. */
  pattern: RegExp;
}

const HTML_RULES: readonly HtmlRule[] = [
  { name: "jQuery", category: "library", pattern: /jquery[.\-/]v?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i },
  { name: "jQuery", category: "library", pattern: /code\.jquery\.com\/jquery-(\d+\.\d+(?:\.\d+)?)/i },
  { name: "React", category: "library", pattern: /react[.@-]v?(\d+\.\d+(?:\.\d+)?)\//i },
  { name: "Vue.js", category: "framework", pattern: /vue(?:\.global)?(?:\.runtime)?[.@-]v?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i },
  { name: "Angular", category: "framework", pattern: /ng-version="([^"]+)"/i },
  { name: "Bootstrap", category: "library", pattern: /bootstrap[.@-]v?(\d+\.\d+(?:\.\d+)?)\//i },
  { name: "Lodash", category: "library", pattern: /lodash[.@-]v?(\d+\.\d+(?:\.\d+)?)\//i },
  { name: "Moment.js", category: "library", pattern: /moment[.@-]v?(\d+\.\d+(?:\.\d+)?)\//i },
  { name: "Next.js", category: "framework", pattern: /\/_next\//i },
  { name: "Nuxt", category: "framework", pattern: /\/_nuxt\//i },
  { name: "WordPress", category: "cms", pattern: /wp-content|wp-includes/i },
  { name: "1С-Битрикс", category: "cms", pattern: /\/bitrix\//i },
  { name: "Shopify", category: "cms", pattern: /cdn\.shopify\.com/i },
  { name: "Tilda", category: "cms", pattern: /tildacdn\.com|tilda\.ws/i },
  { name: "Wix", category: "cms", pattern: /static\.parastorage\.com|wixstatic\.com/i },
  { name: "Google Analytics", category: "analytics", pattern: /googletagmanager\.com\/gtag|google-analytics\.com/i },
  { name: "Яндекс Метрика", category: "analytics", pattern: /mc\.yandex\.ru\/watch|ym\(\d+/i },
  { name: "Meta Pixel", category: "analytics", pattern: /connect\.facebook\.net[^"']*fbevents\.js|fbq\(\s*['"]init/i },
];

const VERSION_IN_GENERATOR: readonly { name: string; pattern: RegExp }[] = [
  { name: "WordPress", pattern: /WordPress\s+(\d+(?:\.\d+)+(?:\.\d+)*)/i },
  { name: "Drupal", pattern: /Drupal\s+(\d+(?:\.\d+)?)/i },
  { name: "Joomla", pattern: /Joomla!?\s+(\d+(?:\.\d+)?)/i },
];

const truncate = (value: string, max = 60): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const keyOf = (name: string, category: TechCategory): string =>
  `${category}:${name.toLowerCase()}`;

/**
 * Распознаёт технологии по HTML-разметке и заголовкам ответа.
 * Дубликаты (одинаковые имя+категория) схлопываются.
 */
export function detectTechnologies(input: TechDetectInput): Technology[] {
  const found = new Map<string, Technology>();
  const add = (name: string, category: TechCategory, version?: string) => {
    const key = keyOf(name, category);
    const existing = found.get(key);
    if (!existing) {
      found.set(key, { name, category, ...(version ? { version } : {}) });
      return;
    }
    if (version && !existing.version) {
      existing.version = version;
    }
  };

  const generator = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i.exec(
    input.html
  )?.[1];
  if (generator) {
    add(truncate(generator.trim()), "server");
    for (const rule of VERSION_IN_GENERATOR) {
      const version = rule.pattern.exec(input.html)?.[1];
      if (version) {
        add(rule.name, "cms", version);
      }
    }
  }

  for (const rule of HTML_RULES) {
    const match = rule.pattern.exec(input.html);
    if (match) {
      add(rule.name, rule.category, match[1]);
    }
  }

  const headers = input.headers ?? {};
  const poweredBy = headers["x-powered-by"];
  if (poweredBy) {
    add(truncate(poweredBy.trim()), "server");
  }
  const server = headers["server"];
  if (server) {
    const version = /^([A-Za-zА-Яа-я][\w.\-]*)\/?([\d.]+)?/.exec(server.trim());
    if (version) {
      add(version[1], "server", version[2] || undefined);
    }
  }

  return [...found.values()];
}

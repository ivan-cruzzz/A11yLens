/**
 * Отчётная логика поверх ScanResult (без пересканирования):
 * план исправления по убыванию эффекта, симуляция «если исправите»,
 * классификация ошибок недоступности и признак «чистого» отчёта.
 * Веса скора не дублируются — берутся из engine/scoring.ts.
 */

import {
  IMPACT_ORDER,
  IMPACT_WEIGHTS,
  SEVERITY_WEIGHTS,
  computeAccessibilityScore,
  computeSecurityScore,
} from "./scoring";
import { categoryOf, tipFor, whyForRule, whyForSecurity } from "./advice";
import type {
  ScanResult,
  SecurityFinding,
  Violation,
} from "./types";

// ── Классификация ошибок недоступности ───────────────────────────────────────

export type ScanFailureKind =
  | "dns"
  | "tls"
  | "not-found"
  | "timeout"
  | "refused"
  | "unknown";

export interface ScanFailure {
  kind: ScanFailureKind;
  /** Короткий заголовок ошибки для интерфейса. */
  title: string;
  /** Что именно произошло — человеческим языком. */
  detail: string;
  /** Что проверить: конкретные шаги для владельца сайта. */
  checks: string[];
}

const FAILURE_BY_KIND: Record<
  Exclude<ScanFailureKind, "unknown">,
  { title: string; detail: string; checks: string[] }
> = {
  dns: {
    title: "Сайт не открылся: домен не находит DNS",
    detail:
      "Имя сайта не разрешается в IP-адрес — браузер даже не дошёл до сервера.",
    checks: [
      "проверьте опечатки в адресе страницы",
      "домен существует, оплачен и его DNS-записи (A/AAAA) заполнены",
      "если записи меняли недавно — обновление DNS может занимать до суток",
      "сайт доступен из других стран и сетей (нет блокировки на уровне DNS)",
    ],
  },
  tls: {
    title: "Не удалось установить защищённое соединение (TLS)",
    detail:
      "Сервер отвечает, но рукопожатие HTTPS не проходит — проблема в сертификате или настройках TLS.",
    checks: [
      "сертификат не истёк (срок действия виден в любом браузере)",
      "домен включён в SAN сертификата, включая вариант с www",
      "установлена цепочка промежуточных сертификатов (chain полный)",
      "включён современный TLS 1.2+ и сервер доступен по 443 порту",
    ],
  },
  "not-found": {
    title: "Страница не найдена (HTTP 404)",
    detail:
      "Сервер ответил, но по этому адресу страницы нет — сайт жив, документ отсутствует.",
    checks: [
      "проверьте адрес: сканируйте главную, если внутренняя страница переехала",
      "настройте 301-редирект со старого адреса на новый",
      "если 404 отдаёт корень сайта — проверьте деплой и роутинг",
    ],
  },
  timeout: {
    title: "Сайт не успел ответить (таймаут)",
    detail:
      "Соединение установлено, но страница не загрузилась за отведённое время — сервер отвечает слишком медленно или блокирует ожидание.",
    checks: [
      "откройте страницу в браузере и замерьте время загрузки",
      "проверьте, не блокирует ли файрвол или гео-фильтр запросы без браузера",
      "повторите попытку позже или увеличьте таймаут (в CLI: --timeout)",
    ],
  },
  refused: {
    title: "Сервер отклонил соединение",
    detail:
      "По этому адресу никто не принимает соединение — сервис на хосте не запущен или порт закрыт.",
    checks: [
      "веб-сервер запущен и слушает нужный порт",
      "хостинг не приостановил сайт (billing/бан)",
      "файрвол сервера пропускает входящие соединения",
    ],
  },
};

const UNKNOWN_FAILURE: Omit<ScanFailure, "detail"> = {
  kind: "unknown",
  title: "Сайт не открылся",
  checks: [
    "откройте адрес в обычном браузере — возможно, показывается капча или защита от ботов",
    "проверьте, что адрес ведёт на веб-страницу, а не на файл или приложение",
    "повторите попытку позже: сбой может быть на стороне хостинга",
  ],
};

/** Классифицирует сырое сообщение об ошибке скана для человека. */
export function classifyScanError(rawMessage: string): ScanFailure {
  const message = rawMessage ?? "";
  const known: ScanFailureKind =
    /ERR_NAME_NOT_RESOLVED|getaddrinfo|ENOTFOUND|nxdomain/i.test(message)
      ? "dns"
      : /ERR_CERT|SSL|TLS|certificate/i.test(message)
        ? "tls"
        : /\b404\b|ERR_HTTP_RESPONSE_CODE_FAILURE|not[\s_-]?found/i.test(
              message
            )
          ? "not-found"
          : /timeout|timed[\s_-]?out|ETIMEDOUT|не уложился/i.test(message)
            ? "timeout"
            : /ERR_CONNECTION_REFUSED|ECONNREFUSED|refused/i.test(message)
              ? "refused"
              : "unknown";

  if (known === "unknown") {
    return { ...UNKNOWN_FAILURE, detail: message };
  }
  return { kind: known, ...FAILURE_BY_KIND[known] };
}

/** Единая строка для интерфейса: заголовок + причина + нумерованный чек-лист. */
export function formatScanFailure(failure: ScanFailure): string {
  const checks = failure.checks
    .map((check, index) => `${index + 1}) ${check}`)
    .join(" ");
  return `${failure.title}. ${failure.detail} Что проверить: ${checks}`;
}

// ── Симуляция «если исправите» ───────────────────────────────────────────────

export interface ScoreSimulation {
  /** Скор доступности после исправления отмеченного. */
  score: number;
  /** Скор безопасности после исправления; null — секции нет в отчёте. */
  securityScore: number | null;
}

/**
 * Пересчитывает оба скора без пересканирования: отмеченные id исключаются,
 * остальное прогоняется через веса из engine/scoring.ts — пересчёт сходится
 * с формулой, по которой построен сам отчёт.
 */
export function simulateScores(
  result: ScanResult,
  fixedIds: Iterable<string>
): ScoreSimulation {
  const fixed = new Set(fixedIds);
  const remainingViolations = result.violations.filter(
    (violation) => !fixed.has(violation.id)
  );
  const securityScore = result.security
    ? computeSecurityScore(
        result.security.findings.filter((finding) => !fixed.has(finding.id))
      )
    : null;
  return {
    score: computeAccessibilityScore(remainingViolations),
    securityScore,
  };
}

// ── План исправления ─────────────────────────────────────────────────────────

export type EffortUnit = "minutes" | "hours" | "days";

export const EFFORT_LABELS: Record<EffortUnit, string> = {
  minutes: "~15 минут",
  hours: "2–4 часа",
  days: "1–2 дня",
};

export const EFFORT_UNIT_LABELS: Record<EffortUnit, string> = {
  minutes: "минуты",
  hours: "часы",
  days: "дни",
};

export interface RemediationStep {
  /** id нарушения или находки, к которой относится шаг. */
  id: string;
  kind: "a11y" | "security";
  title: string;
  /** Почему это проблема — человеческим языком. */
  why: string;
  /** Рецепт исправления. */
  recommendation: string;
  /** Оценка усилия. */
  effort: EffortUnit;
  effortLabel: string;
  /** Сколько очков скора вернёт шаг (веса из engine/scoring.ts). */
  scoreGain: number;
}

/** Оценка усилия по security-проверкам: правки конфигов — минуты, код — часы, миграции — дни. */
const EFFORT_BY_SECURITY: Record<string, EffortUnit> = {
  "sec-csp": "hours",
  "sec-hsts": "minutes",
  "sec-clickjacking": "minutes",
  "sec-nosniff": "minutes",
  "sec-referrer": "minutes",
  "sec-permissions": "minutes",
  "sec-coop": "minutes",
  "sec-cookie-secure": "hours",
  "sec-cookie-httponly": "hours",
  "sec-cookie-samesite": "hours",
  "sec-mixed-content": "hours",
  "sec-sri": "hours",
  "sec-version-disclosure": "minutes",
  "sec-jquery-version": "days",
  "sec-https-redirect": "minutes",
  "sec-git-exposed": "minutes",
  "sec-env-exposed": "minutes",
  "sec-phpinfo": "minutes",
  "sec-backup-config": "minutes",
  "sec-dsstore": "minutes",
};

/** Оценка усилия по правилам axe: точечные правки разметки — минуты, дизайн — часы, поведение — дни. */
const EFFORT_BY_RULE: Record<string, EffortUnit> = {
  "html-has-lang": "minutes",
  "html-lang-valid": "minutes",
  "page-title": "minutes",
  "meta-refresh": "minutes",
  blink: "minutes",
  "meta-viewport": "minutes",
  "empty-heading": "minutes",
  "color-contrast": "hours",
  "video-caption": "hours",
  "scrollable-region-focusable": "hours",
};

const EFFORT_BY_CATEGORY: Record<string, EffortUnit> = {
  contrast: "hours",
  alt: "minutes",
  keyboard: "days",
  forms: "minutes",
  aria: "hours",
  other: "minutes",
};

function estimateA11yEffort(violation: Violation): EffortUnit {
  return EFFORT_BY_RULE[violation.id] ?? EFFORT_BY_CATEGORY[categoryOf(violation.id)] ?? "hours";
}

/** Вклад нарушения в скор — та же формула, что в scoring.ts. */
function violationGain(violation: Violation): number {
  const nodeCount = Math.min(Math.max(violation.nodes.length, 1), 6);
  return IMPACT_WEIGHTS[violation.impact] * nodeCount;
}

/**
 * Поддерживающие шаги: добираются до трёх для непустого отчёта,
 * когда конкретных находок меньше трёх.
 */
const SUPPORT_STEPS: RemediationStep[] = [
  {
    id: "plan-rescan",
    kind: "a11y",
    title: "Перепроверьте сайт после первых исправлений",
    why: "Часть правил axe уходит каскадом: почините разметку — исчезнут и связанные нарушения, а скор вырастет больше ожидаемого.",
    recommendation:
      "Снова запустите скан и сравните скор с текущим — увидите реальный эффект изменений.",
    effort: "minutes",
    effortLabel: EFFORT_LABELS.minutes,
    scoreGain: 0,
  },
  {
    id: "plan-keyboard",
    kind: "a11y",
    title: "Пройдите ключевые сценарии сайта с клавиатуры",
    why: "Автопроверки не видят логику: фокус может застревать в модалках, а Enter — не активировать кнопки. Это чувствуется только руками.",
    recommendation:
      "Tab от первого до последнего интерактивного элемента: фокус не должен пропадать, Enter и Space — активировать, Esc — закрывать окна.",
    effort: "hours",
    effortLabel: EFFORT_LABELS.hours,
    scoreGain: 0,
  },
  {
    id: "plan-templates",
    kind: "a11y",
    title: "Внесите исправления в шаблоны и компоненты, а не только на страницу",
    why: "Точечные правки на опубликованной странице откатываются ближайшим релизом; исправление в шаблоне защищает все страницы сразу.",
    recommendation:
      "Найдите источник каждого нарушения в коде шаблонов и компонентов, затем проверьте новые страницы тем же сканером.",
    effort: "hours",
    effortLabel: EFFORT_LABELS.hours,
    scoreGain: 0,
  },
];

/**
 * План исправления: конкретные действия по убыванию эффекта на скор
 * с оценкой усилия; для непустого отчёта — не менее трёх шагов.
 */
export function buildRemediationPlan(
  result: ScanResult,
  options: { maxSteps?: number } = {}
): RemediationStep[] {
  const maxSteps = options.maxSteps ?? 8;
  if (isCleanReport(result)) {
    return [];
  }

  const severityRank: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };

  const a11ySteps: RemediationStep[] = result.violations.map((violation) => {
    const effort = estimateA11yEffort(violation);
    const recipe = tipFor(violation.id).full;
    return {
      id: violation.id,
      kind: "a11y",
      title: violation.title,
      why: violation.why ?? whyForRule(violation.id),
      recommendation: recipe,
      effort,
      effortLabel: EFFORT_LABELS[effort],
      scoreGain: violationGain(violation),
    };
  });

  const securitySteps: RemediationStep[] = (result.security?.findings ?? []).map(
    (finding: SecurityFinding) => {
      const effort = EFFORT_BY_SECURITY[finding.id] ?? "hours";
      return {
        id: finding.id,
        kind: "security",
        title: finding.title,
        why: finding.why ?? whyForSecurity(finding.id),
        recommendation: finding.recommendation,
        effort,
        effortLabel: EFFORT_LABELS[effort],
        scoreGain: SEVERITY_WEIGHTS[finding.severity],
      };
    }
  );

  const concrete = [...a11ySteps, ...securitySteps]
    .sort((a, b) => {
      if (b.scoreGain !== a.scoreGain) {
        return b.scoreGain - a.scoreGain;
      }
      const rank = (step: RemediationStep) =>
        step.kind === "security"
          ? severityRank[
              result.security?.findings.find((f) => f.id === step.id)
                ?.severity ?? "info"
            ] ?? 3
          : IMPACT_ORDER[
              result.violations.find((v) => v.id === step.id)?.impact ?? "minor"
            ] ?? 3;
      return rank(a) - rank(b);
    })
    .slice(0, maxSteps);

  if (concrete.length >= 3) {
    return concrete;
  }
  const fillers = SUPPORT_STEPS.filter(
    (filler) => !concrete.some((step) => step.id === filler.id)
  ).slice(0, 3 - concrete.length);
  return [...concrete, ...fillers];
}

// ── «Чисто»-состояние ────────────────────────────────────────────────────────

/**
 * Отчёт «чисто»: ни одного нарушения доступности, ни одной находки
 * безопасности — и нет сбоя аудита (это не чисто, а «не проверено»).
 */
export function isCleanReport(result: ScanResult): boolean {
  if (result.totalViolations > 0 || result.violations.length > 0) {
    return false;
  }
  if (!result.security) {
    return true;
  }
  return (
    result.security.findings.length === 0 && !result.security.error
  );
}

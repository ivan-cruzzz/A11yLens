/**
 * Терминальный рендер отчёта (picocolors): сводка, скоры, топ-находки,
 * нативная секция и план исправления. Цвета автоматически отключаются
 * при выводе в трубу (пайп/файл) — picocolors это делает сам.
 */

import pc from "picocolors";
import { IMPACT_WEIGHTS, SEVERITY_WEIGHTS } from "../engine/scoring";
import {
  IMPACT_LABELS,
  SECURITY_SEVERITY_LABELS,
  type Impact,
  type ScanResult,
  type SecuritySeverity,
} from "../engine/types";
import { PORT_INFO } from "../engine/native/ports";
import type { NativeFinding, NativeReport } from "../engine/native";

export interface RenderInput {
  result: ScanResult | null;
  native: NativeReport | null;
  showA11y: boolean;
  showSecurity: boolean;
}

export type Effort = "минуты" | "часы" | "дни";

export interface PlanItem {
  action: string;
  /** Вклад в скор (те же веса, что считает движок). */
  effect: number;
  effort: Effort;
  source: "a11y" | "security" | "native";
}

const severityColor: Record<SecuritySeverity, (text: string) => string> = {
  high: pc.red,
  medium: pc.yellow,
  low: pc.blue,
  info: pc.dim,
};

const impactColor: Record<Impact, (text: string) => string> = {
  critical: (text: string) => pc.bold(pc.red(text)),
  serious: pc.red,
  moderate: pc.yellow,
  minor: pc.dim,
};

const bar = (score: number): string => {
  const filled = Math.max(0, Math.min(10, Math.round(score / 10)));
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
};

const firstSentence = (text: string): string => {
  const match = /[.!?](\s|$)/.exec(text);
  return match ? text.slice(0, match.index + 1) : text;
};

const portLabel = (port: number): string => {
  const info = PORT_INFO[port];
  return info ? `${port} (${info.name})` : String(port);
};

export function buildPlan(
  result: ScanResult | null,
  native: NativeReport | null,
  showA11y: boolean,
  showSecurity: boolean
): PlanItem[] {
  const plan: PlanItem[] = [];

  if (result && showA11y) {
    for (const violation of result.violations) {
      const nodeCount = Math.min(Math.max(violation.nodes.length, 1), 6);
      plan.push({
        action: `Исправьте «${violation.help}» — затронуто элементов: ${nodeCount}`,
        effect: IMPACT_WEIGHTS[violation.impact] * nodeCount,
        effort: violation.impact === "minor" ? "минуты" : "часы",
        source: "a11y",
      });
    }
  }

  if (result?.security && showSecurity) {
    for (const finding of result.security.findings) {
      plan.push({
        action: firstSentence(finding.recommendation),
        effect: SEVERITY_WEIGHTS[finding.severity],
        effort: finding.severity === "high" ? "часы" : "минуты",
        source: "security",
      });
    }
  }

  if (native && showSecurity && !native.error) {
    for (const finding of native.findings) {
      plan.push({
        action: firstSentence(finding.recommendation),
        effect: SEVERITY_WEIGHTS[finding.severity],
        effort: finding.severity === "high" ? "часы" : "минуты",
        source: "native",
      });
    }
  }

  return plan.sort((a, b) => b.effect - a.effect).slice(0, 8);
}

const findingLine = (finding: NativeFinding): string => {
  const label = severityColor[finding.severity](
    `[${SECURITY_SEVERITY_LABELS[finding.severity]}]`
  );
  return [
    `${label} ${pc.bold(finding.title)}`,
    `   Что: ${finding.detail}`,
    `   Доказательство: ${finding.evidence}`,
    `   Рецепт: ${finding.recommendation}`,
  ].join("\n");
};

export function renderReport(input: RenderInput): string {
  const { result, native, showA11y, showSecurity } = input;
  const lines: string[] = [];

  const headUrl = result?.url ?? native?.url;
  if (!headUrl) {
    return "Не удалось получить отчёт сканирования — проверьте адрес и повторите.\n";
  }

  lines.push(`${pc.bold("A11yLens")} · ${headUrl}`);
  const meta = [
    result?.host ?? native?.host,
    result?.meta.title,
    native ? `режим: ${native.mode}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  lines.push(pc.dim(meta));
  lines.push("");

  // ── Скоры ──────────────────────────────────────────────────────────────────
  lines.push(pc.bold("Скор"));
  if (result && showA11y) {
    lines.push(`  Доступность        [${bar(result.score)}] ${result.score}/100`);
  }
  if (result?.security && showSecurity) {
    lines.push(
      `  Безопасность       [${bar(result.security.score)}] ${result.security.score}/100` +
        pc.dim(`  (проверок: ${result.security.checksRun})`)
    );
  }
  if (native && showSecurity) {
    lines.push(
      native.error
        ? `  Нативные проверки   — не выполнены: ${native.error}`
        : `  Нативные проверки  [${bar(native.score)}] ${native.score}/100` +
            pc.dim(`  (проверок: ${native.checksRun})`)
    );
  }
  lines.push("");

  // ── Нарушения доступности ─────────────────────────────────────────────────
  if (result && showA11y) {
    const title = pc.bold(`Нарушения доступности (${result.totalViolations})`);
    lines.push(`— ${title} ${"—".repeat(Math.max(2, 60 - title.length))}`);
    if (result.violations.length === 0) {
      lines.push("  Нарушений не найдено — редкий и приятный результат.");
    }
    for (const violation of result.violations) {
      const label = impactColor[violation.impact](
        `[${IMPACT_LABELS[violation.impact]}]`
      );
      lines.push(
        `  ${label} ${pc.bold(violation.title)} ${pc.dim(
          `(${violation.nodes.length} элем. · ${violation.id})`
        )}`
      );
    }
    lines.push("");
  }

  // ── Безопасность браузера ────────────────────────────────────────────────
  if (result?.security && showSecurity) {
    const security = result.security;
    const title = pc.bold(`Безопасность браузера · ${security.score}/100`);
    lines.push(`— ${title} ${"—".repeat(Math.max(2, 60 - title.length))}`);
    if (security.error) {
      lines.push(`  ${pc.yellow("Аудит не выполнен:")} ${security.error}`);
    } else if (security.findings.length === 0) {
      lines.push("  Замечаний нет — основные заголовки и куки в порядке.");
    }
    for (const finding of security.findings) {
      const label = severityColor[finding.severity](
        `[${SECURITY_SEVERITY_LABELS[finding.severity]}]`
      );
      lines.push(`  ${label} ${pc.bold(finding.title)}`);
      lines.push(`     Что: ${finding.detail}`);
      lines.push(`     Рецепт: ${finding.recommendation}`);
    }
    lines.push("");
  }

  // ── Нативные проверки ──────────────────────────────────────────────────────
  if (native && showSecurity) {
    const title = pc.bold(
      native.error
        ? "Нативные проверки · не выполнены"
        : `Нативные проверки · ${native.score}/100 (проверок: ${native.checksRun})`
    );
    lines.push(`— ${title} ${"—".repeat(Math.max(2, 60 - title.length))}`);
    if (native.error) {
      lines.push(`  ${pc.yellow("Причина:")} ${native.error}`);
    }
    for (const finding of native.findings) {
      lines.push(findingLine(finding).replace(/\n/g, "\n  "));
    }
    if (native.openPorts.length > 0) {
      lines.push(`  Открытые порты: ${native.openPorts.map(portLabel).join(", ")}`);
    }
    if (native.subdomains.length > 0) {
      const sample = native.subdomains.slice(0, 10).join(", ");
      const more = native.subdomains.length > 10 ? ` и ещё ${native.subdomains.length - 10}` : "";
      lines.push(`  Поддомены (${native.subdomains.length}): ${sample}${more}`);
    }
    if (native.technologies.length > 0) {
      lines.push(
        `  Технологии: ${native.technologies
          .map((tech) => (tech.version ? `${tech.name} ${tech.version}` : tech.name))
          .join(", ")}`
      );
    }
    for (const degradation of native.degradations) {
      lines.push(`  ${pc.yellow("Пометка:")} ${degradation}`);
    }
    lines.push("");
  }

  // ── План исправления ───────────────────────────────────────────────────────
  const plan = buildPlan(result, native, showA11y, showSecurity);
  if (plan.length > 0) {
    lines.push(`— ${pc.bold("План исправления")} ${"—".repeat(40)}`);
    plan.forEach((item, index) => {
      lines.push(
        `  ${index + 1}. [эффект ${item.effect} · ${item.effort}] ${item.action}`
      );
    });
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

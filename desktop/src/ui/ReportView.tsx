import { useState } from "react";
import type { Completeness } from "../lib/completeness";
import type {
  EngineReport,
  NativeReport,
  ScanResult,
} from "../lib/report-types";
import { ScoreRing } from "./bits";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  IMPACT_LABELS,
  SEVERITY_LABELS,
} from "./labels";

type TabId = "a11y" | "security" | "native";

/** Полный отчёт: бенто со скорами + вкладки a11y / security / native. */
export default function ReportView({
  report,
  completeness,
  onContinue,
  continueBusy,
}: {
  report: EngineReport;
  completeness: Completeness;
  onContinue: () => void;
  continueBusy: boolean;
}) {
  const [tab, setTab] = useState<TabId>("a11y");
  const scan: ScanResult | undefined = report.scan;
  const native: NativeReport | null | undefined = report.native;

  if (!scan) {
    return null;
  }

  return (
    <section aria-label="Отчёт" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!completeness.complete ? (
        <div className="incomplete-banner" role="alert">
          <span className="mark">неполный</span>
          <ul>
            {completeness.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {completeness.remainingPages > 0 ? (
            <button
              className="continue-button"
              type="button"
              disabled={continueBusy}
              onClick={onContinue}
            >
              {continueBusy
                ? "Продолжаем…"
                : `Продолжить — добрать ${completeness.remainingPages} стр.`}
            </button>
          ) : null}
        </div>
      ) : null}

      {completeness.notes.length > 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          Заметки: {completeness.notes.join(" · ")}
        </p>
      ) : null}

      <div className="bento">
        <ScoreRing value={scan.score} label="Доступность" />
        <ScoreRing
          value={scan.security && !scan.security.error ? scan.security.score : null}
          label="Безопасность"
        />
        <ScoreRing
          value={native && !native.error ? native.score : null}
          label="Нативные проверки"
        />
        <div className="widget">
          <span className="widget-title">Категории нарушений</span>
          <div className="counts">
            {CATEGORY_ORDER.map((category) => (
              <div className="count-row" key={category}>
                <span>{CATEGORY_LABELS[category]}</span>
                <span>{scan.counts[category] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="widget">
          <span className="widget-title">Сводка</span>
          <div className="counts">
            <div className="count-row">
              <span>Нарушений</span>
              <span>{scan.totalViolations}</span>
            </div>
            <div className="count-row">
              <span>Элементов с проблемами</span>
              <span>{scan.totalNodes}</span>
            </div>
            <div className="count-row">
              <span>Страниц</span>
              <span>{scan.pages?.length ?? 1}</span>
            </div>
            <div className="count-row">
              <span>Проверок security</span>
              <span>{scan.security?.checksRun ?? 0}</span>
            </div>
            <div className="count-row">
              <span>Проверок нативных</span>
              <span>{native?.checksRun ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs" role="group" aria-label="Секции отчёта">
        <button className="tab" type="button" aria-pressed={tab === "a11y"} onClick={() => setTab("a11y")}>
          Доступность ({scan.totalViolations})
        </button>
        <button
          className="tab"
          type="button"
          aria-pressed={tab === "security"}
          onClick={() => setTab("security")}
        >
          Безопасность ({scan.security?.findings.length ?? 0})
        </button>
        <button className="tab" type="button" aria-pressed={tab === "native"} onClick={() => setTab("native")}>
          Нативные ({native?.findings.length ?? 0})
        </button>
      </div>

      {tab === "a11y" ? <A11ySection scan={scan} /> : null}
      {tab === "security" ? <SecuritySection scan={scan} /> : null}
      {tab === "native" ? <NativeSection native={native} /> : null}
    </section>
  );
}

function A11ySection({ scan }: { scan: ScanResult }) {
  if (scan.violations.length === 0) {
    return <EmptyState text="Нарушений доступности не найдено — проверьте контраст и разметку на других стандартах (AAA) в веб-версии." />;
  }
  return (
    <div>
      {scan.violations.map((violation) => (
        <article className="finding" key={`${violation.id}-${violation.pageUrl ?? ""}`}>
          <div className="finding-head">
            <span className="finding-title">{violation.title}</span>
            <span className="severity">{IMPACT_LABELS[violation.impact]}</span>
          </div>
          {violation.why ? <p>{violation.why}</p> : <p>{violation.help}</p>}
          <ul className="node-selectors">
            {violation.nodes.slice(0, 4).map((node, index) => (
              <li key={`${node.selector}-${index}`}>
                <code>{node.selector}</code>
              </li>
            ))}
          </ul>
          {violation.pageUrl ? (
            <p>
              Страница: <code>{violation.pageUrl}</code>
            </p>
          ) : null}
          <p>
            <a href={violation.helpUrl} target="_blank" rel="noreferrer">
              Как исправить (документация axe)
            </a>
          </p>
        </article>
      ))}
    </div>
  );
}

function SecuritySection({ scan }: { scan: ScanResult }) {
  const audit = scan.security;
  if (!audit) {
    return <EmptyState text="Секция безопасности пуста." />;
  }
  if (audit.error) {
    return <EmptyState text={`Аудит безопасности не выполнен: ${audit.error}`} />;
  }
  if (audit.findings.length === 0) {
    return <EmptyState text="Проблем безопасности не найдено." />;
  }
  return (
    <div>
      {audit.findings.map((finding) => (
        <article className="finding" key={finding.id}>
          <div className="finding-head">
            <span className="finding-title">{finding.title}</span>
            <span className={`severity ${finding.severity}`}>
              критичность: {SEVERITY_LABELS[finding.severity]}
            </span>
          </div>
          <p>{finding.detail}</p>
          {finding.why ? (
            <p>
              <strong>Почему это важно: </strong>
              {finding.why}
            </p>
          ) : null}
          <p className="quote">
            <strong>Доказательство: </strong>
            {finding.evidence ?? "отсутствует"}
          </p>
          <p>
            <strong>Как исправить: </strong>
            {finding.recommendation}
          </p>
        </article>
      ))}
    </div>
  );
}

function NativeSection({ native }: { native: NativeReport | null | undefined }) {
  if (!native) {
    return <EmptyState text="Нативные проверки не запускались." />;
  }
  if (native.error) {
    return <EmptyState text={`Нативные проверки не выполнены: ${native.error}`} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {native.findings.length === 0 ? (
        <EmptyState text="Нативные проверки не нашли проблем: TLS, порты, поддомены, CVE, почта — чисто." />
      ) : (
        native.findings.map((finding) => (
          <article className="finding" key={finding.id}>
            <div className="finding-head">
              <span className="finding-title">{finding.title}</span>
              <span className={`severity ${finding.severity}`}>
                критичность: {SEVERITY_LABELS[finding.severity]}
              </span>
            </div>
            <p>{finding.detail}</p>
            <p className="quote">
              <strong>Доказательство: </strong>
              {finding.evidence}
            </p>
            <p>
              <strong>Как исправить: </strong>
              {finding.recommendation}
            </p>
          </article>
        ))
      )}

      {native.openPorts.length > 0 ? (
        <div className="card">
          <h2>Открытые порты (топ-100)</h2>
          <div className="chips">
            {native.openPorts.map((port) => (
              <span className="chip" key={port}>
                {port}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {native.subdomains.length > 0 ? (
        <div className="card">
          <h2>Поддомены ({native.subdomains.length})</h2>
          <div className="chips">
            {native.subdomains.slice(0, 40).map((sub) => (
              <span className="chip" key={sub}>
                {sub}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {native.technologies.length > 0 ? (
        <div className="card">
          <h2>Технологии</h2>
          <table className="tech-table">
            <thead>
              <tr>
                <th scope="col">Название</th>
                <th scope="col">Версия</th>
                <th scope="col">Категория</th>
              </tr>
            </thead>
            <tbody>
              {native.technologies.map((tech) => (
                <tr key={`${tech.name}-${tech.category}`}>
                  <td>{tech.name}</td>
                  <td>{tech.version ?? "—"}</td>
                  <td>{tech.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card">
      <p className="hint" style={{ margin: 0 }}>
        {text}
      </p>
    </div>
  );
}

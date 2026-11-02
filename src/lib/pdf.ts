import jsPDF from "jspdf";
import type { ScanResult } from "./types";
import { CATEGORY_LABELS, CATEGORY_ORDER, IMPACT_LABELS } from "./types";
import { buildAdvice, type EngineId } from "./knowledge";

/**
 * Собирает отчёт в скрытом DOM-контейнере, рисует его в canvas
 * (html2canvas-pro поддерживает oklch) и режет на страницы A4.
 */
export async function exportReportPdf(
  result: ScanResult,
  engine: EngineId
): Promise<void> {
  const { html2canvas } = await import("html2canvas-pro");

  const holder = document.createElement("div");
  holder.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;color:#0f172a;font-family:Arial,sans-serif;z-index:-1;";
  holder.innerHTML = buildHtml(result, engine);
  document.body.appendChild(holder);

  try {
    const canvas = await html2canvas(holder, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const slicePageH = (pageH * canvas.width) / pageW;

    let rendered = 0;
    let page = 0;
    while (rendered < canvas.height - 2) {
      const sliceH = Math.min(slicePageH, canvas.height - rendered);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      if (!ctx) {
        break;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(
        canvas,
        0,
        rendered,
        canvas.width,
        sliceH,
        0,
        0,
        canvas.width,
        sliceH
      );
      if (page > 0) {
        pdf.addPage();
      }
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.92),
        "JPEG",
        0,
        0,
        pageW,
        (sliceH * pageW) / canvas.width
      );
      rendered += sliceH;
      page += 1;
    }

    const host = result.host.replace(/[^\w.-]+/g, "_");
    pdf.save(`a11ylens-${host}-${result.scannedAt.slice(0, 10)}.pdf`);
  } finally {
    holder.remove();
  }
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(result: ScanResult, engine: EngineId): string {
  const date = new Date(result.scannedAt).toLocaleString("ru-RU");
  const rows = result.violations
    .map((violation, index) => {
      const advice = buildAdvice(violation.id, engine, "full");
      const nodes = violation.nodes
        .map(
          (node) =>
            `<div style="margin:4px 0 0 12px;color:#475569;font-size:11px;"><code style="font-size:10px;">${esc(node.selector)}</code> ${esc(node.snippet)}</div>`
        )
        .join("");
      return `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <strong style="font-size:13px;">${index + 1}. ${esc(violation.title)}</strong>
          <span style="font-size:11px;color:#64748b;white-space:nowrap;">${CATEGORY_LABELS[violation.category]} · ${IMPACT_LABELS[violation.impact] ?? violation.impact}</span>
        </div>
        <div style="margin-top:4px;font-size:11px;color:#334155;">${esc(advice.short)}</div>
        ${nodes}
        <div style="margin-top:4px;font-size:10px;color:#94a3b8;">WCAG ${advice.wcag} · ${esc(violation.helpUrl)}</div>
      </div>`;
    })
    .join("");

  const countBadges = CATEGORY_ORDER.filter(
    (category) => result.counts[category] > 0
  )
    .map(
      (category) =>
        `<span style="display:inline-block;margin:2px;padding:3px 8px;border-radius:99px;background:#f1f5f9;font-size:11px;">${CATEGORY_LABELS[category]}: <strong>${result.counts[category]}</strong></span>`
    )
    .join("");

  const securityBlock = result.security
    ? `<div style="margin-top:14px;">
        <div style="font-size:13px;font-weight:600;">Безопасность: ${result.security.score}/100 (проверок: ${result.security.checksRun})</div>
        ${
          result.security.findings.length === 0
            ? "<div style='margin-top:6px;font-size:11px;color:#0a0a0a;'>Проблем безопасности не найдено.</div>"
            : `<ul style="margin:8px 0 0;padding:0;list-style:none;">${result.security.findings
                .map(
                  (item) =>
                    `<li style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-bottom:6px;"><strong style="font-size:12px;">${esc(item.title)}</strong> <span style="font-size:10px;color:#64748b;">критичность: ${item.severity}</span><div style="margin-top:3px;font-size:11px;color:#334155;">${esc(item.detail)}</div><div style="margin-top:3px;font-size:11px;color:#0a0a0a;">Как исправить: ${esc(item.recommendation)}</div></li>`
                )
                .join("")}</ul>`
        }
      </div>`
    : "";

  return `
  <div style="padding:32px;">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0a0a0a;padding-bottom:12px;">
      <div>
        <div style="font-size:20px;font-weight:700;">A11yLens — отчёт о доступности</div>
        <div style="color:#475569;font-size:12px;margin-top:2px;">${esc(result.url)} · ${date}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:34px;font-weight:700;color:#0a0a0a;">${result.score}</div>
        <div style="font-size:10px;color:#64748b;">из 100</div>
      </div>
    </div>
    <div style="margin:12px 0;font-size:11px;color:#475569;">
      Стандарт: WCAG ${result.standard} · Устройство: ${result.device === "mobile" ? "мобильное" : "десктоп"} ·
      Правил пройдено: ${result.meta.rulesRun} · Без нарушений: ${result.meta.passedRules} · Время: ${(result.meta.loadMs / 1000).toFixed(1)} с
    </div>
    <div>${countBadges}</div>
    <div style="margin-top:14px;font-size:13px;font-weight:600;">Нарушения (${result.totalViolations})</div>
    <div style="margin-top:8px;">${rows || "<div style='color:#0a0a0a;'>Нарушений не найдено — отличная работа!</div>"}</div>
    ${securityBlock}
  </div>`;
}

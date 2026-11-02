"use client";

import { ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import {
  SECURITY_SEVERITY_LABELS,
  type SecurityFinding,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY_TONE: Record<SecurityFinding["severity"], string> = {
  high: "border-foreground/50 bg-foreground/15 text-foreground",
  medium: "border-foreground/35 bg-foreground/10 text-foreground",
  low: "border-border bg-foreground/5 text-foreground/80",
  info: "border-border bg-muted text-muted-foreground",
};

/**
 * Карточка находки безопасности: доказательство (evidence), объяснение
 * «почему это важно» и чекбокс симуляции «если исправите».
 * Находка без evidence не показывается как сработавшая — её скрывает
 * вызывающий код; если карточка всё же получила такую находку
 * (старый отчёт), доказательство честно помечается отсутствующим.
 */
export default function SecurityRow({
  finding,
  fixed = false,
  onToggleFixed,
}: {
  finding: SecurityFinding;
  fixed?: boolean;
  onToggleFixed?: (fixed: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/60 p-5 transition-opacity",
        fixed && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlertIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span
          className={cn(
            "font-medium text-sm",
            fixed && "line-through decoration-foreground/40"
          )}
        >
          {finding.title}
        </span>
        {fixed ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-foreground/30 bg-foreground/10 px-2 py-0.5 text-[11px] text-foreground">
            <ShieldCheckIcon aria-hidden="true" className="size-3" />
            исправлено
          </span>
        ) : null}
        <span
          className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${SEVERITY_TONE[finding.severity]}`}
        >
          критичность: {SECURITY_SEVERITY_LABELS[finding.severity]}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground text-[13px] leading-relaxed">
        {finding.detail}
      </p>
      {finding.why ? (
        <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">
          <span className="font-medium">Почему это важно: </span>
          {finding.why}
        </p>
      ) : null}
      <p className="mt-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[12px] leading-relaxed">
        <span className="font-medium">Доказательство: </span>
        {finding.evidence ?? "отсутствует — находка старого отчёта без пробы"}
      </p>
      <p className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed">
        <span className="font-medium">Как исправить: </span>
        {finding.recommendation}
      </p>
      {onToggleFixed ? (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
          <input
            checked={fixed}
            className="size-4 accent-[var(--accent)]"
            onChange={(event) => onToggleFixed(event.target.checked)}
            type="checkbox"
          />
          Исправлено — пересчитать скор без пересканирования
        </label>
      ) : null}
    </div>
  );
}

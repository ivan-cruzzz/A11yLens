"use client";

import { ShieldAlertIcon } from "lucide-react";
import {
  SECURITY_SEVERITY_LABELS,
  type SecurityFinding,
} from "@/lib/types";

const SEVERITY_TONE: Record<SecurityFinding["severity"], string> = {
  high: "border-foreground/50 bg-foreground/15 text-foreground",
  medium: "border-foreground/35 bg-foreground/10 text-foreground",
  low: "border-border bg-foreground/5 text-foreground/80",
  info: "border-border bg-muted text-muted-foreground",
};

/** Карточка находки безопасности внутри вкладки «Безопасность». */
export default function SecurityRow({ finding }: { finding: SecurityFinding }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlertIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="font-medium text-sm">{finding.title}</span>
        <span
          className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${SEVERITY_TONE[finding.severity]}`}
        >
          критичность: {SECURITY_SEVERITY_LABELS[finding.severity]}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground text-[13px] leading-relaxed">
        {finding.detail}
      </p>
      <p className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed">
        <span className="font-medium">Как исправить: </span>
        {finding.recommendation}
      </p>
    </div>
  );
}

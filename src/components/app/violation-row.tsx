"use client";

import { AlertTriangleIcon, ExternalLinkIcon } from "lucide-react";
import ViolationModal, {
  type OrderItem,
} from "@/components/app/violation-modal";
import { buildAdvice, type EngineId } from "@/lib/knowledge";
import { IMPACT_LABELS, type Violation } from "@/lib/types";

const IMPACT_STYLES: Record<string, string> = {
  critical: "border-foreground/30 bg-foreground/15 text-foreground",
  serious: "border-foreground/25 bg-foreground/10 text-foreground",
  moderate: "border-border bg-foreground/5 text-foreground/80",
  minor: "border-border bg-muted text-muted-foreground",
};

/** Строка нарушения; клик открывает smooth-drawer с деталями и AI-советом. */
export default function ViolationRow({
  violation,
  index,
  engine,
}: {
  violation: Violation;
  index: number;
  engine: EngineId;
}) {
  const advice = buildAdvice(violation.id, engine, "full");
  const items: OrderItem[] = violation.nodes.map((node, nodeIndex) => ({
    id: `${violation.id}-${nodeIndex}`,
    name: node.selector || "элемент",
    detail: node.snippet,
    price: 1,
  }));

  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${IMPACT_STYLES[violation.impact] ?? IMPACT_STYLES.minor}`}
    >
      <AlertTriangleIcon aria-hidden="true" className="size-3" />
      {IMPACT_LABELS[violation.impact]}
    </span>
  );

  return (
    <ViolationModal
      advice={{ short: advice.short, full: advice.full }}
      confirmLabel="Понятно"
      description={`${violation.nodes.length} элементов · WCAG ${advice.wcag} · ${violation.id}`}
      impactLabel={IMPACT_LABELS[violation.impact]}
      items={items}
      title={violation.title}
    >
      <button
        className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card/60 p-4 text-left outline-none transition-colors duration-150 hover:border-primary/40 hover:bg-card focus-visible:ring-2 focus-visible:ring-primary/40"
        type="button"
      >
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted font-mono text-muted-foreground text-xs">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              {violation.title}
            </span>
            {badge}
          </span>
          <span className="mt-1 block truncate font-mono text-muted-foreground text-xs">
            {violation.nodes[0]?.selector}
          </span>
        </span>
        <span className="mt-1 hidden items-center gap-1 text-muted-foreground text-xs transition-colors group-hover:text-primary sm:flex">
          Детали
          <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
        </span>
      </button>
    </ViolationModal>
  );
}

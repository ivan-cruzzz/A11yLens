"use client";

import { cn } from "@/lib/utils";

/**
 * Мини-график динамики оценок: чистый SVG polyline, без библиотек.
 * Точки — хронологические (старые слева).
 */
export default function ScoreSparkline({
  scores,
  className,
}: {
  scores: number[];
  className?: string;
}) {
  if (scores.length < 2) {
    return null;
  }

  const width = 96;
  const height = 32;
  const padding = 3;
  const stepX = (width - padding * 2) / (scores.length - 1);
  const points = scores.map((score, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (score / 100) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastX = padding + (scores.length - 1) * stepX;
  const lastY =
    height - padding - (scores.at(-1)! / 100) * (height - padding * 2);

  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0 text-foreground", className)}
      fill="none"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <polyline
        className="text-foreground/40"
        points={points.join(" ")}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle
        className="text-foreground"
        cx={lastX}
        cy={lastY}
        fill="currentColor"
        r="2.5"
      />
    </svg>
  );
}

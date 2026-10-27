"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Анимированный счётчик доступности 0–100 с цветовой шкалой. */
export default function ScoreCounter({
  value,
  size = "lg",
  className,
}: {
  value: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration: 1.1,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  const tone =
    value >= 80
      ? "border-foreground/40 border-t-foreground text-foreground"
      : value >= 50
        ? "border-foreground/30 border-t-foreground/70 text-foreground/80"
        : "border-foreground/20 border-t-foreground/40 text-muted-foreground";

  const verdict =
    value >= 80 ? "хорошая" : value >= 50 ? "требует доработки" : "критическая";

  return (
    <div
      className={cn(
        "grid place-items-center rounded-full border-4 border-border/60 tabular-nums",
        size === "lg" ? "size-28 text-4xl" : "size-16 text-xl",
        tone,
        className
      )}
      role="status"
      aria-label={`Оценка доступности: ${value} из 100, состояние ${verdict}`}
    >
      {shown}
    </div>
  );
}

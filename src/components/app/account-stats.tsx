"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDownIcon } from "lucide-react";
import { getAllReports } from "@/lib/report-store";
import { cn } from "@/lib/utils";

interface Stats {
  totalScans: number;
  uniqueHosts: number;
  averageScore: number;
  best: { host: string; score: number } | null;
  worst: { host: string; score: number } | null;
  daily: { label: string; count: number }[];
}

function computeStats(): Stats {
  const reports = getAllReports();
  if (reports.length === 0) {
    return {
      totalScans: 0,
      uniqueHosts: 0,
      averageScore: 0,
      best: null,
      worst: null,
      daily: [],
    };
  }

  const byHost = new Map<string, number>();
  for (const report of reports) {
    // Первый в списке для хоста — самый свежий скан.
    if (!byHost.has(report.host)) {
      byHost.set(report.host, report.score);
    }
  }

  const hosts = [...byHost.entries()];
  const best = hosts.reduce((a, b) => (b[1] > a[1] ? b : a));
  const worst = hosts.reduce((a, b) => (b[1] < a[1] ? b : a));

  const daily: { label: string; count: number }[] = [];
  for (let offset = 13; offset >= 0; offset--) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    daily.push({
      label: String(day.getDate()),
      count: reports.filter((report) => report.scannedAt.startsWith(key))
        .length,
    });
  }

  return {
    totalScans: reports.length,
    uniqueHosts: byHost.size,
    averageScore: Math.round(
      reports.reduce((sum, report) => sum + report.score, 0) / reports.length
    ),
    best: { host: best[0], score: best[1] },
    worst: { host: worst[0], score: worst[1] },
    daily,
  };
}

/** Сворачиваемая секция «Моя статистика» на странице сканера. */
export default function AccountStats() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    setStats(computeStats());
  }, []);

  const maxDaily = useMemo(
    () => Math.max(1, ...(stats?.daily.map((day) => day.count) ?? [1])),
    [stats]
  );

  return (
    <section className="mt-6 max-w-3xl rounded-2xl border border-border bg-card/50">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="font-medium">Моя статистика</span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            {stats && stats.totalScans > 0 ? (
              <div className="border-border border-t px-5 py-4">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Сканов всего", value: stats.totalScans },
                    { label: "Сайтов", value: stats.uniqueHosts },
                    { label: "Средний балл", value: stats.averageScore },
                    {
                      label: "Лучший сайт",
                      value: stats.best ? `${stats.best.score}` : "—",
                    },
                  ].map((item) => (
                    <div
                      className="rounded-xl border border-border bg-background px-3 py-2.5"
                      key={item.label}
                    >
                      <dt className="text-muted-foreground text-[11px]">
                        {item.label}
                      </dt>
                      <dd className="mt-0.5 truncate font-semibold text-lg tabular-nums">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 text-muted-foreground text-xs">
                  Активность за 14 дней
                </p>
                <div
                  aria-hidden="true"
                  className="mt-2 flex h-14 items-end gap-1.5"
                >
                  {stats.daily.map((day) => (
                    <div
                      className="flex flex-1 flex-col items-center gap-1"
                      key={day.label + day.count}
                    >
                      <div
                        className="w-full rounded-t-sm bg-foreground/25"
                        style={{
                          height: `${Math.max(4, (day.count / maxDaily) * 40)}px`,
                        }}
                      />
                      <span className="text-[9px] text-muted-foreground">
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>

                {stats.worst ? (
                  <p className="mt-3 text-muted-foreground text-xs">
                    Худший сайт:{" "}
                    <span className="text-foreground">
                      {stats.worst.host} ({stats.worst.score}/100)
                    </span>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="border-border border-t px-5 py-4 text-muted-foreground text-sm">
                Пока нет данных — просканируйте первый сайт.
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

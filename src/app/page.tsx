"use client";

import Link from "next/link";
import { ArrowRight, ScanEyeIcon } from "lucide-react";
import HalftoneBackground from "@/components/kokonutui/halftone-background";
import CurrencyTransfer from "@/components/kokonutui/currency-transfer";
import HeroForm from "@/components/app/hero-form";
import FeatureBento from "@/components/app/feature-bento";
import LandingNav from "@/components/app/landing-nav";
import LiveDemo from "@/components/app/live-demo";
import { useT, type DictKey } from "@/lib/i18n";

const STEPS: { n: string; title: DictKey; text: DictKey }[] = [
  { n: "01", title: "step1.title", text: "step1.text" },
  { n: "02", title: "step2.title", text: "step2.text" },
  { n: "03", title: "step3.title", text: "step3.text" },
];

export default function Home() {
  const t = useT();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-border/60 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            className="flex items-center gap-2 font-semibold tracking-tight"
            href="/"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <ScanEyeIcon aria-hidden="true" className="size-5" />
            </span>
            A11yLens
          </Link>
          <LandingNav />
        </div>
      </header>

      <main className="flex-1">
        {/* Герой */}
        <section className="relative">
          <HalftoneBackground
            angle={45}
            cell={9}
            className="min-h-[560px] border-border/60 border-b bg-[radial-gradient(60%_80%_at_50%_0%,rgba(255,255,255,0.05),transparent)]"
            loupe
          >
            <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 @3xl:grid-cols-2 @3xl:py-28">
              <div>
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary text-xs font-medium">
                  {t("hero.badge")}
                </p>
                <h1 className="text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
                  {t("hero.title")}
                </h1>
                <p className="mt-4 max-w-md text-muted-foreground">
                  {t("hero.subtitle")}
                </p>
                <div className="mt-8">
                  <HeroForm />
                </div>
                <p className="mt-3 font-mono text-muted-foreground text-xs">
                  {t("hero.example")}
                </p>
              </div>
              <div aria-hidden="true" className="hidden @3xl:block" />
            </div>
          </HalftoneBackground>
        </section>

        {/* Возможности (bento-grid) */}
        <section
          className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6"
          id="features"
        >
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("features.title")}
          </h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            {t("features.subtitle")}
          </p>
          <div className="mt-8">
            <FeatureBento />
          </div>
          <div className="mt-20">
            <LiveDemo />
          </div>
        </section>

        {/* Как это работает */}
        <section className="border-border/60 border-y bg-card/30" id="how">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("how.title")}
              </h2>
              <ol className="mt-8 space-y-6">
                {STEPS.map((step) => (
                  <li className="flex gap-4" key={step.n}>
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 font-mono text-primary text-sm"
                    >
                      {step.n}
                    </span>
                    <div>
                      <h3 className="font-medium">{t(step.title)}</h3>
                      <p className="mt-1 text-muted-foreground text-sm">
                        {t(step.text)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
                href="/scan"
              >
                {t("how.cta")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <div className="mx-auto w-full max-w-md">
              <p className="mb-4 text-center text-muted-foreground text-sm">
                {t("how.demoCaption")}
              </p>
              <CurrencyTransfer
                from={{
                  amount: 1,
                  currency: "СТР",
                  symbol: "#",
                  bank: "Проверяемая страница",
                }}
                locale="ru-RU"
                rate={60}
                timestamp="прямо сейчас"
                to={{
                  amount: 60,
                  currency: "ПРВ",
                  symbol: "✓",
                  bank: "A11yLens · отчёт",
                  name: "Правила WCAG",
                }}
                txnId="WCAG 2.2 AA"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-border/60 border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-muted-foreground text-sm sm:flex-row sm:px-6">
          <p>A11yLens — {t("footer.tagline")}</p>
          <p className="font-mono text-xs">
            Node.js · axe-core · Playwright · Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import ParticleButton from "@/components/kokonutui/particle-button";
import { registerPathIfNeeded } from "@/lib/account";

export default function HeroForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  const start = async () => {
    const target = url.trim() || "example.com";
    await new Promise((resolve) => setTimeout(resolve, 650));
    router.push(
      registerPathIfNeeded(`/scan?url=${encodeURIComponent(target)}`)
    );
  };

  return (
    <form
      className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        void start();
      }}
    >
      <label className="sr-only" htmlFor="hero-url">
        Адрес сайта
      </label>
      <input
        autoComplete="url"
        className="h-12 flex-1 rounded-xl border border-border bg-card/70 px-4 font-mono text-sm text-foreground shadow-inner outline-none backdrop-blur transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30"
        id="hero-url"
        inputMode="url"
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://example.com"
        type="url"
        value={url}
      />
      <ParticleButton
        className="h-12 rounded-xl px-6 text-sm"
        onClick={start}
        pendingLabel="Открываем сканер…"
        successLabel="Готово!"
        type="button"
        variant="default"
      >
        Проверить сайт
        <ArrowRight aria-hidden="true" className="size-4" />
      </ParticleButton>
    </form>
  );
}

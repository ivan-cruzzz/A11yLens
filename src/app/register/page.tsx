"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, ScanEyeIcon, ShuffleIcon } from "lucide-react";
import {
  createFace,
  FaceArt,
  avatarSeed,
} from "@/components/kokonutui/avatar-picker";
import { normalizeNextPath, saveAccount } from "@/lib/account";

function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = normalizeNextPath(searchParams.get("next"));

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [variant, setVariant] = useState(1);
  const [siteName, setSiteName] = useState("");

  const face = useMemo(
    () => createFace(avatarSeed(name.trim() || "A11yLens", variant)),
    [name, variant]
  );

  useEffect(() => {
    // Уже есть аккаунт — регистрация не нужна.
    if (window.localStorage.getItem("a11ylens:account:v1")) {
      router.replace(next);
    }
  }, [next, router]);

  // Предзаполняем «Название сайта» хостом из ?next=/scan?url=…
  useEffect(() => {
    const urlParam = new URLSearchParams(searchParams.get("next") ?? "").get(
      "url"
    );
    if (!urlParam) {
      return;
    }
    try {
      const host = new URL(
        /^https?:\/\//i.test(urlParam) ? urlParam : `https://${urlParam}`
      ).hostname;
      setSiteName(host);
    } catch {
      // Не похоже на адрес — оставляем поле пустым.
    }
  }, [searchParams]);

  const submitStepOne = () => {
    const found: string[] = [];
    if (!name.trim()) {
      found.push("Укажите имя");
    }
    if (!/.+@.+\..+/.test(email)) {
      found.push("Укажите корректный e-mail");
    }
    if (password.length < 8) {
      found.push("Пароль — минимум 8 символов");
    }
    if (password !== passwordAgain) {
      found.push("Пароли не совпадают");
    }
    setErrors(found);
    if (found.length === 0) {
      setStep(2);
    }
  };

  const submitStepTwo = () => {
    saveAccount({
      displayName: name.trim(),
      email: email.trim(),
      avatar: { displayName: name.trim(), variant },
      siteName: siteName.trim() || "Мой сайт",
      createdAt: new Date().toISOString(),
    });
    router.replace(next);
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
      <p className="mb-1 text-muted-foreground text-xs">Шаг {step} из 2</p>
      <h1 className="text-xl font-semibold tracking-tight">
        {step === 1 ? "Создайте аккаунт" : "Выберите лицо отчёта"}
      </h1>

      {errors.length > 0 ? (
        <ul
          className="mt-4 space-y-1 rounded-xl border border-border bg-background p-3 text-foreground/80 text-xs"
          role="alert"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {step === 1 ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitStepOne();
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm" htmlFor="reg-name">
              Имя
            </label>
            <input
              autoComplete="name"
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
              id="reg-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Как к вам обращаться"
              type="text"
              value={name}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm" htmlFor="reg-email">
              E-mail
            </label>
            <input
              autoComplete="email"
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
              id="reg-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm" htmlFor="reg-password">
              Пароль
            </label>
            <input
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
              id="reg-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Минимум 8 символов"
              type="password"
              value={password}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm" htmlFor="reg-password2">
              Повторите пароль
            </label>
            <input
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
              id="reg-password2"
              onChange={(event) => setPasswordAgain(event.target.value)}
              type="password"
              value={passwordAgain}
            />
          </div>
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
            type="submit"
          >
            Далее
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </button>
        </form>
      ) : (
        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            submitStepTwo();
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <FaceArt
              aria-hidden="true"
              className="size-24 rounded-full border border-border"
              face={face}
            />
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
              onClick={() => setVariant((value) => value + 1)}
              type="button"
            >
              <ShuffleIcon aria-hidden="true" className="size-3.5" />
              Другое лицо
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-sm" htmlFor="reg-site">
              Название сайта
            </label>
            <input
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/15"
              id="reg-site"
              onChange={(event) => setSiteName(event.target.value)}
              placeholder="Мой сайт"
              type="text"
              value={siteName}
            />
          </div>
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
            type="submit"
          >
            Создать аккаунт
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </button>
        </form>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border/60">
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
          <Link
            className="rounded-lg px-3 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/"
          >
            На главную
          </Link>
        </div>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-12 sm:px-6">
        <Suspense fallback={null}>
          <RegisterForm />
        </Suspense>
      </main>
    </div>
  );
}

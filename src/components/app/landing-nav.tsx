"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanEyeIcon } from "lucide-react";
import {
  createFace,
  FaceArt,
  avatarSeed,
} from "@/components/kokonutui/avatar-picker";
import { loadAccount, registerPathIfNeeded, type Account } from "@/lib/account";
import { LocaleToggle, useT } from "@/lib/i18n";

/** Навигация шапки лендинга: ссылки, профиль и CTA с гейтом регистрации. */
export default function LandingNav() {
  const router = useRouter();
  const t = useT();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    setAccount(loadAccount());
  }, []);

  const face = useMemo(
    () =>
      account
        ? createFace(
            avatarSeed(account.avatar.displayName, account.avatar.variant)
          )
        : null,
    [account]
  );

  const openScanner = () => {
    router.push(registerPathIfNeeded("/scan"));
  };

  return (
    <nav
      aria-label="Основная навигация"
      className="flex min-w-0 items-center gap-2"
    >
      <a
        className="hidden rounded-lg px-3 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground sm:block"
        href="#features"
      >
        {t("nav.features")}
      </a>
      <a
        className="hidden rounded-lg px-3 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground sm:block"
        href="#how"
      >
        {t("nav.how")}
      </a>
      <LocaleToggle />
      {account && face ? (
        <Link
          className="mr-1 flex min-w-0 items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:border-foreground/30"
          href="/scan"
        >
          <FaceArt
            aria-hidden="true"
            className="size-7 shrink-0 rounded-full"
            face={face}
          />
          <span className="truncate text-sm">{account.displayName}</span>
        </Link>
      ) : null}
      <button
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
        onClick={openScanner}
        type="button"
      >
        <ScanEyeIcon aria-hidden="true" className="size-4" />
        {t("nav.openScanner")}
      </button>
    </nav>
  );
}

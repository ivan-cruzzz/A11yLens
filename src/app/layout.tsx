import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/app/toast";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "A11yLens — проверка доступности сайтов",
  description:
    "Введите URL — получите отчёт по контрастам, alt-текстам и клавиатурной навигации с AI-советами по исправлению, скриншотами нарушений и экспортом в PDF.",
};

/**
 * Применяет сохранённую тему до первой отрисовки: data-theme на <html>
 * (light/dark/system) и класс dark для Tailwind-варианта. Без скрипта —
 * светлая вспышка на тёмной системной теме.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("a11ylens:theme:v1");if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=t;r.classList.toggle("dark",d)}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      data-theme="system"
      suppressHydrationWarning
      className={`dark ${plexSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

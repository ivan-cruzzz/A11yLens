import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сканер доступности — A11yLens",
  description:
    "Сканирование страницы: контрасты, alt-тексты, клавиатурная навигация, AI-советы, скриншоты нарушений и экспорт PDF.",
};

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

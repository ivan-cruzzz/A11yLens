import { NextResponse } from "next/server";
import { runScan } from "@/engine";
import type { Device, ScanRequest, Standard } from "@/engine";

/**
 * Тонкая обёртка: валидация входа и вызов движка.
 * Вся логика сканирования — в src/engine/.
 */
export async function POST(request: Request) {
  let body: ScanRequest;
  try {
    body = (await request.json()) as ScanRequest;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body.url && !body.html) {
    return NextResponse.json(
      { error: "Передайте url или html" },
      { status: 400 }
    );
  }

  const standard: Standard = ["AA", "AAA", "508"].includes(body.standard)
    ? body.standard
    : "AA";
  const device: Device = body.device === "mobile" ? "mobile" : "desktop";

  try {
    const result = await runScan({
      url: body.url,
      html: body.html,
      standard,
      device,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось отсканировать страницу";
    const friendly = /ERR_NAME_NOT_RESOLVED|net::|Timeout|NS_ERROR/i.test(
      message
    )
      ? "Сайт не открылся: проверьте адрес или доступность страницы"
      : message;
    return NextResponse.json({ error: friendly }, { status: 422 });
  }
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * SVG-бейдж оценки доступности (mono, тёмный): /badge?score=76&label=example.com
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const scoreRaw = Number.parseInt(params.get("score") ?? "0", 10);
  const score = Number.isNaN(scoreRaw)
    ? 0
    : Math.min(100, Math.max(0, scoreRaw));
  const label = (params.get("label") ?? "a11y").slice(0, 24);
  const badgeX = 10 + label.length * 6.6 + 6;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="28" role="img" aria-label="${escapeXml(label)}: ${score} of 100">
  <rect rx="6" width="150" height="28" fill="#0a0a0a"/>
  <rect x="1" y="1" rx="5" width="148" height="26" fill="none" stroke="#262626"/>
  <text x="10" y="18" font-family="Menlo,Consolas,monospace" font-size="11" fill="#a1a1aa">${escapeXml(label)}</text>
  <rect x="${badgeX.toFixed(1)}" y="6" rx="4" width="42" height="16" fill="#fafafa"/>
  <text x="${(badgeX + 6).toFixed(1)}" y="17.5" font-family="Menlo,Consolas,monospace" font-size="10" font-weight="700" fill="#0a0a0a">${score}/100</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

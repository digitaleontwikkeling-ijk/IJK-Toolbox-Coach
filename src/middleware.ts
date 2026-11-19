/**
 * Beveiligingsheader die bepaalt waar de app ingesloten mag worden (iframe):
 * alleen in de eigen site en in Microsoft Teams / Microsoft 365.
 * TODO: lijst controleren tegen de actuele Microsoft-documentatie voor Teams-tabbladen.
 * EXTRA_FRAME_ANCESTORS (spatie-gescheiden) is alleen bedoeld voor tests.
 */
import { NextResponse } from "next/server";

const TEAMS = [
  "https://teams.microsoft.com",
  "https://*.teams.microsoft.com",
  "https://*.cloud.microsoft",
  "https://*.office.com",
  "https://*.microsoft365.com",
];

export function middleware() {
  const res = NextResponse.next();
  const extra = (process.env.EXTRA_FRAME_ANCESTORS ?? "").split(/\s+/).filter(Boolean);
  res.headers.set("Content-Security-Policy", `frame-ancestors 'self' ${[...TEAMS, ...extra].join(" ")}`);
  return res;
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };

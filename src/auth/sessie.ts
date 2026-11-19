/**
 * Sessie en autorisatie.
 *
 * Proof of concept: de sessie is een ondertekende cookie (HMAC-SHA256) met de
 * gegevens van een testgebruiker. Bij de overstap naar Entra ID / Teams-SSO
 * vervangt een gevalideerd Entra-token deze cookie; de rest van de app gebruikt
 * alleen `Gebruiker` en hoeft dan niet te veranderen.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../lib/config";
import { ROLLEN, type Rol } from "./rollen";

export const SESSIE_COOKIE = "tc_sessie";
const GELDIGHEID_SECONDEN = 8 * 60 * 60;

export interface Gebruiker {
  /** Pseudoniem gebruikers-ID: dit wordt opgeslagen en naar de coach gestuurd. */
  pseudoniemId: string;
  /** Alleen voor weergave in de interface; wordt nergens opgeslagen. */
  naam: string;
  /** Alleen meegestuurd met acties als ACTIE_STUUR_UPN=true; wordt nergens opgeslagen. */
  upn?: string;
  rollen: Rol[];
}

interface SessieInhoud {
  oid: string;
  naam: string;
  upn?: string;
  rollen: Rol[];
  verloopt: number;
}

function onderteken(data: string): string {
  return createHmac("sha256", config.sessieGeheim).update(data).digest("base64url");
}

export function maakPseudoniem(oid: string): string {
  return createHmac("sha256", config.pseudoniemGeheim).update(oid).digest("hex").slice(0, 32);
}

export function maakSessieCookie(inhoud: Omit<SessieInhoud, "verloopt">, nu = Date.now()): string {
  const data = Buffer.from(
    JSON.stringify({ ...inhoud, verloopt: Math.floor(nu / 1000) + GELDIGHEID_SECONDEN }),
  ).toString("base64url");
  return `${data}.${onderteken(data)}`;
}

export function cookieOpties() {
  return {
    httpOnly: true,
    // In Teams draait de app in een iframe; daarvoor is SameSite=None; Secure nodig (fase 6).
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GELDIGHEID_SECONDEN,
  };
}

/** Leest en controleert de sessiecookie. Geeft `null` bij ontbrekende, vervalste of verlopen sessie. */
export function leesSessie(cookieWaarde: string | undefined, nu = Date.now()): Gebruiker | null {
  if (!cookieWaarde) return null;
  const [data, handtekening] = cookieWaarde.split(".");
  if (!data || !handtekening) return null;
  const verwacht = Buffer.from(onderteken(data));
  const gekregen = Buffer.from(handtekening);
  if (verwacht.length !== gekregen.length || !timingSafeEqual(verwacht, gekregen)) return null;
  let inhoud: SessieInhoud;
  try {
    inhoud = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof inhoud.verloopt !== "number" || inhoud.verloopt * 1000 < nu) return null;
  const rollen = (inhoud.rollen ?? []).filter((r): r is Rol => (ROLLEN as readonly string[]).includes(r));
  return {
    pseudoniemId: maakPseudoniem(inhoud.oid),
    naam: String(inhoud.naam ?? ""),
    upn: typeof inhoud.upn === "string" ? inhoud.upn : undefined,
    rollen,
  };
}

/** Haalt de cookie uit een Request (route handlers). */
export function gebruikerUitRequest(req: Request): Gebruiker | null {
  const header = req.headers.get("cookie") ?? "";
  const waarde = header
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${SESSIE_COOKIE}=`))
    ?.slice(SESSIE_COOKIE.length + 1);
  return leesSessie(waarde ? decodeURIComponent(waarde) : undefined);
}

export function heeftRol(g: Gebruiker, ...rollen: Rol[]): boolean {
  return g.rollen.some((r) => rollen.includes(r));
}

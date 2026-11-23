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
  /** Voor weergave; opgeslagen bij een advies (voor toetsers en beheerders) als AANVRAGER_OPSLAAN aan staat. Nooit naar de coach. */
  naam: string;
  /** E-mailadres (UPN). Opgeslagen bij een advies als AANVRAGER_OPSLAAN aan staat; met acties alleen als ACTIE_STUUR_UPN=true. */
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

/**
 * De Set-Cookie-header voor de sessie.
 * In een iframe van Teams (andere site) is SameSite=None; Secure; Partitioned nodig,
 * anders stuurt de browser de cookie niet mee. Buiten Teams volstaat SameSite=Lax.
 */
export function sessieCookieHeader(waarde: string, opties: { inIframe: boolean; maxAge?: number }): string {
  const maxAge = opties.maxAge ?? GELDIGHEID_SECONDEN;
  const basis = `${SESSIE_COOKIE}=${encodeURIComponent(waarde)}; Path=/; Max-Age=${maxAge}; HttpOnly`;
  if (opties.inIframe) return `${basis}; SameSite=None; Secure; Partitioned`;
  return `${basis}; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
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

/**
 * Controle van een Microsoft Entra ID-token (uit Teams-SSO of MSAL).
 *
 * - Handtekening tegen de openbare sleutels (JWKS) van de tenant.
 * - Uitgever: de eigen tenant (v1- of v2-token). Tokens van andere tenants worden geweigerd.
 * - Doelgroep (aud): de client-ID of de Application ID URI van deze app.
 * - Rollen: App Roles uit de claim `roles`, plus de standaardrol (medewerker).
 *
 * Er wordt niets uit het token opgeslagen behalve, via de sessie, het pseudoniem
 * dat van het object-ID (oid) wordt afgeleid.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { ROLLEN, type Rol } from "./rollen";

export interface EntraInstellingen {
  tenantId: string;
  clientId: string;
  appIdUri: string;
  standaardRol: string;
  jwksUrl: string;
}

export interface EntraIdentiteit {
  oid: string;
  naam: string;
  upn?: string;
  rollen: Rol[];
}

export class OngeldigTokenFout extends Error {}

const sleutelsets = new Map<string, JWTVerifyGetKey>();

export async function controleerEntraToken(token: string, e: EntraInstellingen, nu?: Date): Promise<EntraIdentiteit> {
  let sleutels = sleutelsets.get(e.jwksUrl);
  if (!sleutels) {
    sleutels = createRemoteJWKSet(new URL(e.jwksUrl));
    sleutelsets.set(e.jwksUrl, sleutels);
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(token, sleutels, {
      issuer: [`https://login.microsoftonline.com/${e.tenantId}/v2.0`, `https://sts.windows.net/${e.tenantId}/`],
      audience: [e.clientId, e.appIdUri],
      algorithms: ["RS256"],
      currentDate: nu,
      clockTolerance: 60,
    }));
  } catch (err) {
    throw new OngeldigTokenFout(`Token geweigerd: ${(err as Error).message}`);
  }
  if (payload.tid !== e.tenantId) throw new OngeldigTokenFout("Token is van een andere tenant.");
  const oid = payload.oid;
  if (typeof oid !== "string" || !oid) throw new OngeldigTokenFout("Token mist het object-ID (oid).");

  const tokenRollen = Array.isArray(payload.roles) ? (payload.roles as unknown[]).filter((r): r is string => typeof r === "string") : [];
  const rollen = [...new Set([e.standaardRol, ...tokenRollen])].filter((r): r is Rol =>
    (ROLLEN as readonly string[]).includes(r),
  );
  const upn = [payload.upn, payload.preferred_username].find((x): x is string => typeof x === "string");
  return { oid, naam: typeof payload.name === "string" ? payload.name : "Medewerker", upn, rollen };
}

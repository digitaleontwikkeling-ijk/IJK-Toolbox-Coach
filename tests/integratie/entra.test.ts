/**
 * Inloggen met Entra ID: tokencontrole tegen een eigen (nep)sleutelset.
 * Er worden geen echte Microsoft-tokens gebruikt.
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { controleerEntraToken } from "@/auth/entra";
import { gebruikerUitRequest, maakPseudoniem } from "@/auth/sessie";
import * as sessieRoute from "@/app/api/sessie/entra/route";

const TENANT = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const APP_URI = `api://coach.voorbeeld.invalid/${CLIENT}`;
let sleutel: KeyLike;
let vreemdeSleutel: KeyLike;
let server: ReturnType<typeof createServer>;
let instellingen: Parameters<typeof controleerEntraToken>[1];

async function token(claims: Record<string, unknown> = {}, opties: { sleutel?: KeyLike; kid?: string; exp?: string } = {}) {
  return new SignJWT({ tid: TENANT, oid: "oid-anna", name: "Anna Test", upn: "anna@voorbeeld.invalid", roles: [], ...claims })
    .setProtectedHeader({ alg: "RS256", kid: opties.kid ?? "sleutel-1" })
    .setIssuer(`https://login.microsoftonline.com/${TENANT}/v2.0`)
    .setAudience(APP_URI)
    .setIssuedAt()
    .setExpirationTime(opties.exp ?? "1h")
    .sign(opties.sleutel ?? sleutel);
}

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const paar = await generateKeyPair("RS256");
  sleutel = paar.privateKey;
  vreemdeSleutel = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(paar.publicKey)), kid: "sleutel-1", alg: "RS256", use: "sig" };
  server = createServer((_, res) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ keys: [jwk] })));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const jwksUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/keys`;
  instellingen = { tenantId: TENANT, clientId: CLIENT, appIdUri: APP_URI, standaardRol: "medewerker", jwksUrl };
  Object.assign(process.env, {
    AUTH_MODUS: "entra",
    ENTRA_TENANT_ID: TENANT,
    ENTRA_CLIENT_ID: CLIENT,
    ENTRA_APP_ID_URI: APP_URI,
    ENTRA_JWKS_URL: jwksUrl,
  });
});
afterAll(() => {
  for (const k of ["AUTH_MODUS", "ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "ENTRA_APP_ID_URI", "ENTRA_JWKS_URL"]) delete process.env[k];
  server.close();
});

describe("tokencontrole", () => {
  it("E1. geldig token: identiteit met standaardrol en App Roles", async () => {
    const id = await controleerEntraToken(await token({ roles: ["toetser_architect", "onbekende_rol"] }), instellingen);
    // Toetsers krijgen de rol medewerker niet automatisch: zij dienen zelf geen aanvragen in.
    expect(id).toEqual({ oid: "oid-anna", naam: "Anna Test", upn: "anna@voorbeeld.invalid", rollen: ["toetser_architect"] });
    expect((await controleerEntraToken(await token({ roles: ["beheerder"] }), instellingen)).rollen).toEqual(["beheerder"]);
    expect((await controleerEntraToken(await token({ roles: [] }), instellingen)).rollen).toEqual(["medewerker"]);
  });

  it("E2. v1-token (sts.windows.net) met client-ID als doelgroep wordt ook geaccepteerd", async () => {
    const t = await new SignJWT({ tid: TENANT, oid: "oid-x", name: "X" })
      .setProtectedHeader({ alg: "RS256", kid: "sleutel-1" })
      .setIssuer(`https://sts.windows.net/${TENANT}/`)
      .setAudience(CLIENT)
      .setExpirationTime("1h")
      .sign(sleutel);
    expect((await controleerEntraToken(t, instellingen)).oid).toBe("oid-x");
  });

  it.each([
    ["verkeerde handtekening", () => token({}, { sleutel: vreemdeSleutel })],
    ["verlopen token", () => token({}, { exp: "-2h" })],
    ["andere tenant", () => token({ tid: "33333333-3333-4333-8333-333333333333" })],
    ["zonder oid", () => token({ oid: undefined })],
    [
      "verkeerde doelgroep",
      () => new SignJWT({ tid: TENANT, oid: "x" }).setProtectedHeader({ alg: "RS256", kid: "sleutel-1" })
        .setIssuer(`https://login.microsoftonline.com/${TENANT}/v2.0`).setAudience("api://andere-app").setExpirationTime("1h").sign(sleutel),
    ],
    [
      "andere uitgever",
      () => new SignJWT({ tid: TENANT, oid: "x" }).setProtectedHeader({ alg: "RS256", kid: "sleutel-1" })
        .setIssuer("https://login.microsoftonline.com/common/v2.0").setAudience(APP_URI).setExpirationTime("1h").sign(sleutel),
    ],
  ])("E3. geweigerd: %s", async (_naam, maak) => {
    await expect(controleerEntraToken(await maak(), instellingen)).rejects.toThrow();
  });
});

describe("sessie via Entra", () => {
  it("E4. /api/sessie/entra maakt een sessiecookie die in een Teams-iframe werkt", async () => {
    const res = await sessieRoute.POST(
      new Request("http://test/api/sessie/entra", { method: "POST", body: JSON.stringify({ token: await token({ roles: ["beheerder"] }) }) }),
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=None; Secure; Partitioned/);
    const g = gebruikerUitRequest(new Request("http://test", { headers: { cookie: cookie.split(";")[0]! } }));
    expect(g).toMatchObject({ pseudoniemId: maakPseudoniem("oid-anna"), rollen: ["beheerder"] });
  });

  it("E5. ongeldig token: 401, geen cookie", async () => {
    const res = await sessieRoute.POST(
      new Request("http://test/api/sessie/entra", { method: "POST", body: JSON.stringify({ token: await token({}, { sleutel: vreemdeSleutel }) }) }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

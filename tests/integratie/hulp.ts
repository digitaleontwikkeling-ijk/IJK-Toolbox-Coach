/** Gedeelde hulpfuncties voor integratietests van de API. */
import { expect } from "vitest";
import { maakSessieCookie, SESSIE_COOKIE } from "@/auth/sessie";
import type { Rol } from "@/auth/rollen";
import * as conceptRoute from "@/app/api/concept/route";
import * as conceptIdRoute from "@/app/api/concept/[id]/route";
import * as adviesRoute from "@/app/api/advies/route";
import { db } from "@/db/pool";
import { RUSTIG } from "../helpers";

export type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export const ANNA: TestGebruiker = { oid: "int-anna", naam: "Anna", upn: "anna@voorbeeld.invalid", rollen: ["medewerker"] };
export const BRAM: TestGebruiker = { oid: "int-bram", naam: "Bram", rollen: ["medewerker"] };

export async function roep(
  handler: Handler,
  opties: { gebruiker?: TestGebruiker | null; body?: unknown; params?: Record<string, string>; cookie?: string; method?: string } = {},
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  const g = opties.gebruiker === undefined ? ANNA : opties.gebruiker;
  if (opties.cookie) headers.set("cookie", opties.cookie);
  else if (g) headers.set("cookie", `${SESSIE_COOKIE}=${encodeURIComponent(maakSessieCookie(g))}`);
  const req = new Request("http://test.local/api", {
    method: opties.method ?? (opties.body === undefined ? "GET" : "POST"),
    headers,
    body: opties.body === undefined ? undefined : typeof opties.body === "string" ? opties.body : JSON.stringify(opties.body),
  });
  const res = await handler(req, { params: Promise.resolve(opties.params ?? {}) });
  return { status: res.status, json: await res.json() };
}

/** Een volledig ingevulde wizard (scenario 4: verzuimdashboard). */
export const VOLLEDIG = {
  stap: 3,
  beschrijving: "Verzuimdashboard van mijn afdeling (testscenario).",
  verduidelijkingGevraagd: true,
  tooladvies: { tool: "claude_code", behoefte: "bouwen", motivatie: "Dashboard bouwen.", bron: "coach", geaccepteerd: true },
  checks: { data: "persoonsgegevens", systemen: "lezen", gebruikers: "afdeling", autonomie: "lezen", impact: { beschikbaarheid: "serieus", integriteit: "nauwelijks", vertrouwelijkheid: "nauwelijks" }, afhankelijkheid: "experiment" },
  extraVragen: { bijzondere_persoonsgegevens: true },
  rodeVlaggen: { persoonlijke_inlog_of_secrets: false, ai_beslist_over_mensen: false, open_zonder_toetsing: false, proces_zonder_eigenaar: false },
  // Verdieping (regelset 0.8): geen AI; privacy-indicatoren bijzondere persoonsgegevens (extra vraag) en
  // kwetsbare groepen (zieke medewerkers) → 2 indicatoren → "Waarschijnlijk volledige DPIA nodig".
  verdieping: { ...RUSTIG, kwetsbare_groepen: "ja" },
  chat: [{ rol: "medewerker", tekst: "Dit gesprek mag niet in het register." }],
};

export async function nieuwConcept(gebruiker: TestGebruiker = ANNA, data: unknown = VOLLEDIG): Promise<string> {
  const c = await roep(conceptRoute.POST as Handler, { gebruiker, method: "POST" });
  const id = c.json.concept.id as string;
  const r = await roep(conceptIdRoute.PUT as Handler, { gebruiker, params: { id }, body: data, method: "PUT" });
  expect(r.status).toBe(200);
  return id;
}


export type TestGebruiker = { oid: string; naam: string; upn?: string; rollen: Rol[] };
export const COMPLIANCE: TestGebruiker = { oid: "int-c", naam: "C", upn: "c@voorbeeld.invalid", rollen: ["toetser_compliance"] };
export const ARCHITECT: TestGebruiker = { oid: "int-a", naam: "A", rollen: ["toetser_architect"] };
export const BEHEERDER: TestGebruiker = { oid: "int-b", naam: "B", rollen: ["beheerder"] };

/** Maakt een advies voor `gebruiker` met de gegeven wizardgegevens en geeft het terug. */
export async function nieuwAdvies(gebruiker: TestGebruiker = ANNA, data: unknown = VOLLEDIG) {
  const id = await nieuwConcept(gebruiker, data);
  const r = await roep(adviesRoute.POST as Handler, { gebruiker, body: { conceptId: id } });
  expect(r.status).toBe(200);
  return r.json.advies as { id: string; referentie: string; uitkomst: string; toetsers: string[] };
}

export async function leegDatabase() {
  await db().query("TRUNCATE concept, besluit, audit_log, actie_log, advies, referentie_teller, mailsjabloon RESTART IDENTITY CASCADE");
}

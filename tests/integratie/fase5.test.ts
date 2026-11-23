/**
 * Fase 5: vervolgacties (webhooks), toetsing, besluiten, beheer en audit-log.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookActieClient } from "@/acties/ActieClient";
import { voerVervolgactieUit } from "@/acties/vervolgactie";
import { maakPseudoniem } from "@/auth/sessie";
import { migreer } from "@/db/migreer";
import { db, sluitDb } from "@/db/pool";
import * as actieRoute from "@/app/api/advies/[id]/actie/route";
import * as adviesIdRoute from "@/app/api/advies/[id]/route";
import * as toetsingRoute from "@/app/api/toetsing/route";
import * as toetsingIdRoute from "@/app/api/toetsing/[id]/route";
import * as besluitRoute from "@/app/api/toetsing/[id]/besluit/route";
import * as beheerRoute from "@/app/api/beheer/adviezen/route";
import * as beheerIdRoute from "@/app/api/beheer/adviezen/[id]/route";
import { startWebhookMock } from "../../mocks/webhook-mock";
import { content } from "../helpers";
import { ANNA, ARCHITECT, BEHEERDER, BRAM, COMPLIANCE, leegDatabase, nieuwAdvies, roep, VOLLEDIG, type Handler } from "./hulp";

const GEHEIM = "test-webhook-geheim";
let mock: Awaited<ReturnType<typeof startWebhookMock>>;

// Adviezen per uitkomst (VOLLEDIG = scenario 4: oranje, beide toetsers, DPIA)
const GROEN = {
  ...VOLLEDIG,
  checks: { data: "openbaar", systemen: "geen", gebruikers: "alleen_ik", autonomie: "assisteren", impact: { beschikbaarheid: "nauwelijks", integriteit: "nauwelijks", vertrouwelijkheid: "nauwelijks" }, afhankelijkheid: "experiment" },
  extraVragen: {},
};
const ALLEEN_ARCHITECT = { ...GROEN, checks: { ...GROEN.checks, systemen: "koppelen" } };
const ALLEEN_COMPLIANCE = { ...GROEN, checks: { ...GROEN.checks, impact: { ...GROEN.checks.impact, integriteit: "serieus" } } };

const actie = (id: string, gebruiker = ANNA) => roep(actieRoute.POST as Handler, { gebruiker, params: { id }, method: "POST" });
const besluit = (id: string, gebruiker: typeof ANNA, b: object) =>
  roep(besluitRoute.POST as Handler, { gebruiker, params: { id }, body: b });

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  mock = await startWebhookMock({ geheim: GEHEIM, stil: true });
  Object.assign(process.env, {
    ACTIE_MODUS: "webhook",
    ACTIE_ACCOUNT_URL: `${mock.url}/account`,
    ACTIE_TOETSING_URL: `${mock.url}/toetsing`,
    ACTIE_MELDING_URL: `${mock.url}/melding`,
    ACTIE_CONTACT_URL: `${mock.url}/contact`,
    ACTIE_GEHEIM: GEHEIM,
    APP_URL: "https://coach.test",
  });
  await migreer();
});
beforeEach(async () => {
  await leegDatabase();
  mock.ontvangen.length = 0;
  delete process.env.ACTIE_STUUR_UPN;
});
afterAll(async () => {
  for (const k of ["ACTIE_MODUS", "ACTIE_ACCOUNT_URL", "ACTIE_TOETSING_URL", "ACTIE_MELDING_URL", "ACTIE_CONTACT_URL", "ACTIE_GEHEIM", "APP_URL", "ACTIE_STUUR_UPN"]) {
    delete process.env[k];
  }
  await mock.stop();
  await sluitDb();
});

describe("vervolgacties via webhooks", () => {
  it("F1. Direct aan de slag: accountaanvraag met geheim, idempotency-sleutel en minimale payload", async () => {
    const a = await nieuwAdvies(ANNA, GROEN);
    const r = await actie(a.id);
    expect(r.json.status).toBe("account_aangevraagd");
    expect(mock.ontvangen).toHaveLength(1);
    const w = mock.ontvangen[0]!;
    expect(w.pad).toBe("/account");
    expect(w.headers["x-ijk-webhook-secret"]).toBe(GEHEIM);
    expect(w.headers["idempotency-key"]).toBe(`${a.id}:accountaanvraag`);
    expect(w.body).toMatchObject({
      type: "accountaanvraag",
      referentie: a.referentie,
      tool: { id: "claude_code", naam: "Claude Code" },
      uitkomst: { kleur: "groen", naam: "Direct aan de slag" },
      link: `https://coach.test/advies/${a.id}`,
      aanvrager: { pseudoniemId: maakPseudoniem(ANNA.oid) },
    });
    const tekst = JSON.stringify(w.body);
    for (const verboden of ["beschrijving", "Verzuimdashboard", "Anna", "anna@"]) expect(tekst).not.toContain(verboden);
    const log = (await db().query("SELECT type, resultaat FROM actie_log")).rows;
    expect(log).toEqual([{ type: "accountaanvraag", resultaat: "verstuurd" }]);
  });

  it("F2. Aan de slag met voorwaarden: de voorwaarden gaan mee; UPN alleen als dat is ingesteld", async () => {
    process.env.ACTIE_STUUR_UPN = "true";
    const a = await nieuwAdvies(ANNA, { ...GROEN, checks: { ...GROEN.checks, gebruikers: "collegas" } });
    await actie(a.id);
    expect(mock.ontvangen[0]!.body).toMatchObject({
      voorwaarden: ["Gaat je team erop vertrouwen? Wijs een eigenaar aan en documenteer."],
      aanvrager: { upn: "anna@voorbeeld.invalid" },
    });
  });

  it("F3. Eerst toetsen: aanvraag naar beide toetsers én een Teams-melding", async () => {
    const a = await nieuwAdvies();
    const r = await actie(a.id);
    expect(r.json).toEqual({ status: "in_toetsing", meldingVerstuurd: true });
    expect(mock.ontvangen.map((o) => o.pad)).toEqual(["/toetsing", "/melding"]);
    expect(mock.ontvangen[0]!.body).toMatchObject({
      type: "toetsing",
      dpiaSignaal: true,
      link: `https://coach.test/toetsing/${a.id}`,
      toetsers: [
        { rol: "toetser_compliance", naam: "AI governance & compliance officer" },
        { rol: "toetser_architect", naam: "architect Digitale Ontwikkeling" },
      ],
    });
    expect(mock.ontvangen[1]!.body.tekst).toContain(a.referentie);
  });

  it("F4. mislukte webhook: status terug naar 'advies gegeven', foutmelding, en later opnieuw proberen lukt", async () => {
    const a = await nieuwAdvies(ANNA, GROEN);
    const instellingen = {
      urls: { accountaanvraag: `${mock.url}/fout`, toetsing: "", teams_melding: "", contact: "" },
      geheim: GEHEIM,
      geheimHeader: "X-IJK-Webhook-Secret",
      timeoutMs: 2000,
    };
    const gebruiker = { pseudoniemId: maakPseudoniem(ANNA.oid), naam: "Anna", rollen: ["medewerker" as const] };
    const opties = { adviesId: a.id, gebruiker, content, appUrl: "https://coach.test", stuurUpn: false };
    await expect(voerVervolgactieUit({ ...opties, client: new WebhookActieClient(instellingen) })).rejects.toMatchObject({ status: 502 });
    expect((await db().query("SELECT status FROM advies")).rows[0].status).toBe("advies_gegeven");
    expect((await db().query("SELECT resultaat, http_status FROM actie_log")).rows).toEqual([{ resultaat: "mislukt", http_status: 500 }]);
    expect((await actie(a.id)).json.status).toBe("account_aangevraagd");
  });

  it("F5. mislukte Teams-melding houdt de aanvraag tegen? Nee: status blijft 'in toetsing', melding wordt gelogd", async () => {
    const a = await nieuwAdvies();
    const instellingen = {
      urls: { accountaanvraag: "", toetsing: `${mock.url}/toetsing`, teams_melding: `${mock.url}/melding/fout`, contact: "" },
      geheim: GEHEIM,
      geheimHeader: "X-IJK-Webhook-Secret",
      timeoutMs: 2000,
    };
    const gebruiker = { pseudoniemId: maakPseudoniem(ANNA.oid), naam: "Anna", rollen: ["medewerker" as const] };
    const r = await voerVervolgactieUit({ adviesId: a.id, gebruiker, content, appUrl: "x", stuurUpn: false, client: new WebhookActieClient(instellingen) });
    expect(r).toEqual({ status: "in_toetsing", meldingVerstuurd: false });
  });

  it("F6. dubbel klikken: maar één aanvraag", async () => {
    const a = await nieuwAdvies(ANNA, GROEN);
    const [x, y] = await Promise.all([actie(a.id), actie(a.id)]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    expect(mock.ontvangen).toHaveLength(1);
  });

  it("F7. webhook-ontvanger weigert een verkeerd geheim", async () => {
    const res = await fetch(`${mock.url}/account`, { method: "POST", headers: { "X-IJK-Webhook-Secret": "fout" }, body: "{}" });
    expect(res.status).toBe(401);
  });
});

describe("toetsing", () => {
  it("F8. een medewerker zonder toetserrol heeft geen toegang (403)", async () => {
    expect((await roep(toetsingRoute.GET as Handler, { gebruiker: ANNA })).status).toBe(403);
    expect((await roep(beheerRoute.GET as Handler, { gebruiker: ANNA })).status).toBe(403);
  });

  it("F9. toetsers zien alleen ingediende aanvragen die bij hun rol horen", async () => {
    const arch = await nieuwAdvies(ANNA, ALLEEN_ARCHITECT);
    const comp = await nieuwAdvies(ANNA, ALLEEN_COMPLIANCE);
    const nietIngediend = await nieuwAdvies(BRAM, ALLEEN_ARCHITECT);
    await actie(arch.id);
    await actie(comp.id);
    const lijstA = (await roep(toetsingRoute.GET as Handler, { gebruiker: ARCHITECT })).json.adviezen.map((a: { id: string }) => a.id);
    expect(lijstA).toEqual([arch.id]);
    const lijstC = (await roep(toetsingRoute.GET as Handler, { gebruiker: COMPLIANCE })).json.adviezen.map((a: { id: string }) => a.id);
    expect(lijstC).toEqual([comp.id]);
    expect((await roep(toetsingIdRoute.GET as Handler, { gebruiker: ARCHITECT, params: { id: comp.id } })).status).toBe(404);
    expect((await roep(toetsingIdRoute.GET as Handler, { gebruiker: ARCHITECT, params: { id: nietIngediend.id } })).status).toBe(404);
  });

  it("F10. toetser ziet alle antwoorden, uitkomst en regelversie; inzage wordt in de audit-log gezet", async () => {
    const a = await nieuwAdvies();
    await actie(a.id);
    const r = await roep(toetsingIdRoute.GET as Handler, { gebruiker: COMPLIANCE, params: { id: a.id } });
    expect(r.json.advies).toMatchObject({
      beschrijving: VOLLEDIG.beschrijving,
      antwoorden: { checks: VOLLEDIG.checks, extraVragen: { bijzondere_persoonsgegevens: true } },
      rodeVlaggen: VOLLEDIG.rodeVlaggen,
      uitkomst: "oranje",
      dpiaSignaal: true,
      regelversie: "0.5",
      besluiten: [],
    });
    await roep(toetsingRoute.GET as Handler, { gebruiker: COMPLIANCE });
    const log = (await db().query("SELECT pseudoniem_id, rol, actie, advies_id FROM audit_log ORDER BY id")).rows;
    expect(log).toEqual([
      { pseudoniem_id: maakPseudoniem(COMPLIANCE.oid), rol: "toetser_compliance", actie: "inzage_advies", advies_id: a.id },
      { pseudoniem_id: maakPseudoniem(COMPLIANCE.oid), rol: "toetser_compliance", actie: "inzage_lijst", advies_id: null },
    ]);
  });

  it("F11. 'met voorwaarden' en 'afgewezen' vereisen een toelichting", async () => {
    const a = await nieuwAdvies();
    await actie(a.id);
    expect((await besluit(a.id, COMPLIANCE, { besluit: "goedgekeurd_met_voorwaarden" })).status).toBe(400);
    expect((await besluit(a.id, COMPLIANCE, { besluit: "afgewezen", toelichting: "" })).status).toBe(400);
    expect((await besluit(a.id, COMPLIANCE, { besluit: "misschien" })).status).toBe(400);
  });

  it("F12. eindstatus pas na alle toetsers; één besluit per rol; daarna geen besluiten meer", async () => {
    const a = await nieuwAdvies();
    await actie(a.id);
    let r = await besluit(a.id, COMPLIANCE, { besluit: "goedgekeurd_met_voorwaarden", toelichting: "Alleen met geanonimiseerde testdata." });
    expect(r.json.status).toBe("in_toetsing");
    expect((await besluit(a.id, COMPLIANCE, { besluit: "goedgekeurd" })).status).toBe(409);
    r = await besluit(a.id, ARCHITECT, { besluit: "goedgekeurd" });
    expect(r.json.status).toBe("goedgekeurd_met_voorwaarden");
    expect((await besluit(a.id, ARCHITECT, { besluit: "afgewezen", toelichting: "Toch niet." })).status).toBe(409);
    // De medewerker ziet de besluiten bij zijn advies.
    const eigen = await roep(adviesIdRoute.GET as Handler, { gebruiker: ANNA, params: { id: a.id } });
    expect(eigen.json.advies.status).toBe("goedgekeurd_met_voorwaarden");
    expect(eigen.json.advies.besluiten.map((b: { toelichting: string }) => b.toelichting)).toContain("Alleen met geanonimiseerde testdata.");
    expect(JSON.stringify(eigen.json)).not.toContain(maakPseudoniem(COMPLIANCE.oid));
  });

  it("F13. één afwijzing → afgewezen", async () => {
    const a = await nieuwAdvies();
    await actie(a.id);
    await besluit(a.id, COMPLIANCE, { besluit: "afgewezen", toelichting: "Eerst een DPIA uitvoeren." });
    expect((await besluit(a.id, ARCHITECT, { besluit: "goedgekeurd" })).json.status).toBe("afgewezen");
  });

  it("F14. een toetser kan zijn eigen aanvraag niet toetsen", async () => {
    const a = await nieuwAdvies(COMPLIANCE, ALLEEN_COMPLIANCE);
    await actie(a.id, COMPLIANCE);
    expect((await besluit(a.id, COMPLIANCE, { besluit: "goedgekeurd" })).status).toBe(403);
  });

  it("F15. een toetser kan niet besluiten over een aanvraag van een andere rol", async () => {
    const a = await nieuwAdvies(ANNA, ALLEEN_COMPLIANCE);
    await actie(a.id);
    expect((await besluit(a.id, ARCHITECT, { besluit: "goedgekeurd" })).status).toBe(404);
  });
});

describe("beheer", () => {
  it("F16. beheerder ziet alle adviezen (ook niet ingediende), met audit-log; besluiten mag hij niet", async () => {
    await nieuwAdvies(ANNA, GROEN);
    const b = await nieuwAdvies(BRAM);
    const lijst = await roep(beheerRoute.GET as Handler, { gebruiker: BEHEERDER });
    expect(lijst.json.adviezen).toHaveLength(2);
    expect((await roep(beheerIdRoute.GET as Handler, { gebruiker: BEHEERDER, params: { id: b.id } })).json.advies.referentie).toBe(b.referentie);
    expect((await besluit(b.id, BEHEERDER, { besluit: "goedgekeurd" })).status).toBe(403);
    const acties = (await db().query("SELECT rol, actie FROM audit_log ORDER BY id")).rows;
    expect(acties).toEqual([
      { rol: "beheerder", actie: "inzage_lijst" },
      { rol: "beheerder", actie: "inzage_advies" },
    ]);
  });
});

describe("regelset 0.4: contact volgt, ter informatie en AI Act", () => {
  // Rood zonder alternatief: Vertrouwelijkheid = Groot (scenario 9).
  const ROOD_ZONDER_ALT = { ...GROEN, checks: { ...GROEN.checks, impact: { ...GROEN.checks.impact, vertrouwelijkheid: "groot" } } };
  // Rood met alternatief: rode vlag 1.
  const ROOD_MET_ALT = { ...GROEN, rodeVlaggen: { ...GROEN.rodeVlaggen, niet_goedgekeurde_tool: true } };

  it("F17. rood zonder alternatief: direct een melding aan Team DO en status 'contact volgt'", async () => {
    const a = (await nieuwAdvies(ANNA, ROOD_ZONDER_ALT)) as unknown as { id: string; status: string; referentie: string };
    expect(a.status).toBe("contact_volgt");
    expect(mock.ontvangen.map((o) => o.pad)).toEqual(["/contact"]);
    expect(mock.ontvangen[0]!.body).toMatchObject({
      type: "contact",
      referentie: a.referentie,
      link: `https://coach.test/beheer/advies/${a.id}`,
      uitkomst: { kleur: "rood" },
    });
    // Geen tweede melding voor hetzelfde advies.
    expect((await actie(a.id)).status).toBe(409);
    expect(mock.ontvangen).toHaveLength(1);
  });

  it("F18. rood mét alternatief: geen melding, status blijft 'advies gegeven'", async () => {
    const a = (await nieuwAdvies(ANNA, ROOD_MET_ALT)) as unknown as { status: string };
    expect(a.status).toBe("advies_gegeven");
    expect(mock.ontvangen).toEqual([]);
  });

  it("F19. mislukte contactmelding: status blijft 'advies gegeven', opnieuw proberen lukt", async () => {
    process.env.ACTIE_CONTACT_URL = `${mock.url}/contact/fout`;
    vi.resetModules();
    const { POST: adviesPost } = await import("@/app/api/advies/route");
    const id = await (await import("./hulp")).nieuwConcept(ANNA, ROOD_ZONDER_ALT);
    const r = await roep(adviesPost as Handler, { body: { conceptId: id } });
    expect(r.json.advies.status).toBe("advies_gegeven");
    process.env.ACTIE_CONTACT_URL = `${mock.url}/contact`;
    vi.resetModules();
    const { POST: actiePost } = await import("@/app/api/advies/[id]/actie/route");
    expect((await roep(actiePost as Handler, { params: { id: r.json.advies.id }, method: "POST" })).json.status).toBe("contact_volgt");
  });

  it("F20. toetsers zien rode adviezen ter informatie, maar kunnen er niet over besluiten", async () => {
    const zonder = await nieuwAdvies(ANNA, ROOD_ZONDER_ALT);
    const met = await nieuwAdvies(BRAM, ROOD_MET_ALT);
    for (const toetser of [COMPLIANCE, ARCHITECT]) {
      const ids = (await roep(toetsingRoute.GET as Handler, { gebruiker: toetser })).json.adviezen.map((x: { id: string }) => x.id);
      expect(ids.sort()).toEqual([zonder.id, met.id].sort());
    }
    expect((await roep(toetsingIdRoute.GET as Handler, { gebruiker: ARCHITECT, params: { id: met.id } })).json.advies.openRollen).toEqual([]);
    expect([404, 409]).toContain((await besluit(met.id, ARCHITECT, { besluit: "goedgekeurd" })).status);
    expect([404, 409]).toContain((await besluit(zonder.id, COMPLIANCE, { besluit: "goedgekeurd" })).status);
  });

  it("F21. het AI Act-signaal en de deelscores van Impact staan in het adviesregister", async () => {
    const data = { ...GROEN, checks: { ...GROEN.checks, autonomie: "handelen", impact: { beschikbaarheid: "beperkt", integriteit: "serieus", vertrouwelijkheid: "nauwelijks" } } };
    const a = await nieuwAdvies(ANNA, data);
    const rij = (await db().query("SELECT ai_act_signaal, dpia_signaal, antwoorden FROM advies WHERE id = $1", [a.id])).rows[0];
    expect(rij.ai_act_signaal).toBe(true);
    expect(rij.dpia_signaal).toBe(false);
    expect(rij.antwoorden.checks.impact).toEqual({ beschikbaarheid: "beperkt", integriteit: "serieus", vertrouwelijkheid: "nauwelijks" });
    expect(a.toetsers).toEqual(["toetser_compliance"]);
  });
});

/**
 * Integratietests van de API: echte route handlers tegen een echte (test)database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { maakSessieCookie, SESSIE_COOKIE } from "@/auth/sessie";
import type { Rol } from "@/auth/rollen";
import { ANNA, BRAM, leegDatabase, nieuwConcept, roep, VOLLEDIG, type Handler } from "./hulp";
import { migreer } from "@/db/migreer";
import { db, sluitDb } from "@/db/pool";
import * as conceptRoute from "@/app/api/concept/route";
import * as conceptIdRoute from "@/app/api/concept/[id]/route";
import * as adviesRoute from "@/app/api/advies/route";
import * as adviesIdRoute from "@/app/api/advies/[id]/route";
import * as actieRoute from "@/app/api/advies/[id]/actie/route";
import * as opnieuwRoute from "@/app/api/advies/[id]/opnieuw/route";
import * as coachRoute from "@/app/api/coach/[taak]/route";
import * as contentRoute from "@/app/api/content/route";
import * as mijnRoute from "@/app/api/mijn-aanvragen/route";

beforeAll(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  await migreer();
});
beforeEach(async () => {
  await leegDatabase();
});
afterAll(sluitDb);

describe("authenticatie en autorisatie", () => {
  it("I1. zonder sessie: 401 op elke route", async () => {
    for (const h of [contentRoute.GET, conceptRoute.GET, mijnRoute.GET] as Handler[]) {
      expect((await roep(h, { gebruiker: null })).status).toBe(401);
    }
  });

  it("I2. vervalste of gemanipuleerde sessiecookie: 401", async () => {
    const echt = maakSessieCookie(ANNA);
    const [data] = echt.split(".");
    const vals = Buffer.from(JSON.stringify({ ...ANNA, rollen: ["beheerder"], verloopt: 9e9 })).toString("base64url");
    expect((await roep(contentRoute.GET as Handler, { cookie: `${SESSIE_COOKIE}=${vals}.${echt.split(".")[1]}` })).status).toBe(401);
    expect((await roep(contentRoute.GET as Handler, { cookie: `${SESSIE_COOKIE}=${data}.ongeldig` })).status).toBe(401);
  });

  it("I3. verlopen sessie: 401", async () => {
    const oud = maakSessieCookie(ANNA, Date.now() - 9 * 60 * 60 * 1000);
    expect((await roep(contentRoute.GET as Handler, { cookie: `${SESSIE_COOKIE}=${encodeURIComponent(oud)}` })).status).toBe(401);
  });

  it("I4. een gebruiker zonder de rol medewerker heeft geen toegang tot de wizard-routes", async () => {
    const alleenToetser = { oid: "int-t", naam: "T", rollen: ["toetser_compliance"] as Rol[] };
    expect((await roep(conceptRoute.GET as Handler, { gebruiker: alleenToetser })).status).toBe(403);
  });
});

describe("content en concept", () => {
  it("I5. content bevat de regelset met versie", async () => {
    const r = await roep(contentRoute.GET as Handler);
    expect(r.status).toBe(200);
    expect(r.json.regelset.versie).toBe("0.3");
    expect(r.json.gebruiker).toEqual({ naam: "Anna", rollen: ["medewerker"] });
  });

  it("I6. ongeldige wizardgegevens worden geweigerd", async () => {
    const id = await nieuwConcept();
    const r = await roep(conceptIdRoute.PUT as Handler, { params: { id }, body: { stap: 9, checks: { data: "<script>" } }, method: "PUT" });
    expect(r.status).toBe(400);
  });

  it("I7. kapotte JSON geeft 400", async () => {
    const id = await nieuwConcept();
    expect((await roep(conceptIdRoute.PUT as Handler, { params: { id }, body: "{kapot", method: "PUT" })).status).toBe(400);
  });

  it("I8. het concept van een ander kun je niet wijzigen of verwijderen", async () => {
    const id = await nieuwConcept(ANNA);
    expect((await roep(conceptIdRoute.PUT as Handler, { gebruiker: BRAM, params: { id }, body: VOLLEDIG, method: "PUT" })).status).toBe(404);
    await roep(conceptIdRoute.DELETE as Handler, { gebruiker: BRAM, params: { id }, method: "DELETE" });
    const anna = await roep(conceptRoute.GET as Handler, { gebruiker: ANNA });
    expect(anna.json.concept.id).toBe(id);
  });
});

describe("adviesregister", () => {
  it("I9. onvolledige antwoorden: 400 met de ontbrekende velden", async () => {
    const id = await nieuwConcept(ANNA, { ...VOLLEDIG, rodeVlaggen: {} });
    const r = await roep(adviesRoute.POST as Handler, { body: { conceptId: id } });
    expect(r.status).toBe(400);
    expect(r.json.details).toContain('rode vlag "niet_goedgekeurde_tool" is niet beantwoord');
  });

  it("I10. zonder gekozen tool: 400", async () => {
    const id = await nieuwConcept(ANNA, { ...VOLLEDIG, tooladvies: null });
    expect((await roep(adviesRoute.POST as Handler, { body: { conceptId: id } })).status).toBe(400);
  });

  it("I11. volledig advies wordt vastgelegd met referentie, uitkomst en regelversie, zonder chat of pseudoniem", async () => {
    const id = await nieuwConcept();
    const r = await roep(adviesRoute.POST as Handler, { body: { conceptId: id } });
    expect(r.status).toBe(200);
    const a = r.json.advies;
    expect(a.referentie).toBe(`TC-${new Date().getFullYear()}-0001`);
    expect(a).toMatchObject({ uitkomst: "oranje", dpiaSignaal: true, regelversie: "0.3", status: "advies_gegeven" });
    expect(a.toetsers).toEqual(["toetser_compliance", "toetser_architect"]);
    expect(a.pseudoniemId).toBeUndefined();
    const rij = (await db().query("SELECT * FROM advies")).rows[0];
    expect(JSON.stringify(rij)).not.toContain("Dit gesprek");
    expect(JSON.stringify(rij)).not.toContain("Anna");
    expect(rij.pseudoniem_id).toMatch(/^[0-9a-f]{32}$/);
    // Bewaartermijn: standaard 12 maanden
    const maanden = (new Date(rij.verloopt_op).getTime() - Date.now()) / (30.4 * 24 * 3600 * 1000);
    expect(Math.round(maanden)).toBe(12);
  });

  it("I12. teruggaan en opnieuw berekenen zonder vervolgactie: zelfde advies, zelfde referentie", async () => {
    const id = await nieuwConcept();
    const eerste = await roep(adviesRoute.POST as Handler, { body: { conceptId: id } });
    await roep(conceptIdRoute.PUT as Handler, { params: { id }, body: { ...VOLLEDIG, checks: { ...VOLLEDIG.checks, data: "intern", gebruikers: "alleen_ik", impact: "nauwelijks" } }, method: "PUT" });
    const tweede = await roep(adviesRoute.POST as Handler, { body: { conceptId: id } });
    expect(tweede.json.advies.id).toBe(eerste.json.advies.id);
    expect(tweede.json.advies.referentie).toBe(eerste.json.advies.referentie);
    expect(tweede.json.advies.uitkomst).toBe("geel");
    expect((await db().query("SELECT count(*)::int AS n FROM advies")).rows[0].n).toBe(1);
  });

  it("I13. vervolgactie: status wijzigt, concept (met chat) wordt verwijderd, tweede keer 409", async () => {
    const id = await nieuwConcept();
    const a = (await roep(adviesRoute.POST as Handler, { body: { conceptId: id } })).json.advies;
    const r = await roep(actieRoute.POST as Handler, { params: { id: a.id }, method: "POST" });
    expect(r.json).toEqual({ status: "in_toetsing", meldingVerstuurd: true });
    expect((await db().query("SELECT count(*)::int AS n FROM concept")).rows[0].n).toBe(0);
    expect((await roep(actieRoute.POST as Handler, { params: { id: a.id }, method: "POST" })).status).toBe(409);
  });

  it("I14. bij rood is er geen aanvraag mogelijk (409)", async () => {
    const id = await nieuwConcept(ANNA, { ...VOLLEDIG, rodeVlaggen: { ...VOLLEDIG.rodeVlaggen, niet_goedgekeurde_tool: true } });
    const a = (await roep(adviesRoute.POST as Handler, { body: { conceptId: id } })).json.advies;
    expect(a.uitkomst).toBe("rood");
    expect((await roep(actieRoute.POST as Handler, { params: { id: a.id }, method: "POST" })).status).toBe(409);
  });

  it("I15. je ziet alleen je eigen adviezen", async () => {
    const id = await nieuwConcept(ANNA);
    const a = (await roep(adviesRoute.POST as Handler, { body: { conceptId: id } })).json.advies;
    expect((await roep(adviesIdRoute.GET as Handler, { gebruiker: BRAM, params: { id: a.id } })).status).toBe(404);
    expect((await roep(actieRoute.POST as Handler, { gebruiker: BRAM, params: { id: a.id }, method: "POST" })).status).toBe(404);
    expect((await roep(mijnRoute.GET as Handler, { gebruiker: BRAM })).json.adviezen).toEqual([]);
    expect((await roep(mijnRoute.GET as Handler, { gebruiker: ANNA })).json.adviezen).toHaveLength(1);
    // Ook een advies-ID van een ander concept registreren lukt niet.
    expect((await roep(adviesRoute.POST as Handler, { gebruiker: BRAM, body: { conceptId: id } })).status).toBe(404);
  });

  it("I16. ongeldige id's geven 404, geen databasefout", async () => {
    expect((await roep(adviesIdRoute.GET as Handler, { params: { id: "1 OR 1=1" } })).status).toBe(404);
  });

  it("I17. Er is iets veranderd: nieuw concept met vorige antwoorden; nieuw advies met verwijzing naar het vorige", async () => {
    const id = await nieuwConcept();
    const eerste = (await roep(adviesRoute.POST as Handler, { body: { conceptId: id } })).json.advies;
    await roep(actieRoute.POST as Handler, { params: { id: eerste.id }, method: "POST" });

    const o = await roep(opnieuwRoute.POST as Handler, { params: { id: eerste.id }, method: "POST" });
    expect(o.json.concept.data).toMatchObject({ stap: 1, vorigAdviesId: eerste.id, checks: VOLLEDIG.checks, chat: [] });
    const nieuwId = o.json.concept.id;
    const data = { ...o.json.concept.data, tooladvies: { ...o.json.concept.data.tooladvies, geaccepteerd: true } };
    await roep(conceptIdRoute.PUT as Handler, { params: { id: nieuwId }, body: data, method: "PUT" });
    const tweede = (await roep(adviesRoute.POST as Handler, { body: { conceptId: nieuwId } })).json.advies;
    expect(tweede.referentie).toMatch(/-0002$/);
    expect(tweede.vorigAdviesId).toBe(eerste.id);
  });
});

describe("coach-routes", () => {
  it("I18. onbekende taak: 404", async () => {
    expect((await roep(coachRoute.POST as Handler, { params: { taak: "bepaal_kleur" }, body: {} })).status).toBe(404);
  });

  it("I19. te lange invoer wordt geweigerd", async () => {
    const r = await roep(coachRoute.POST as Handler, { params: { taak: "verduidelijk" }, body: { beschrijving: "x".repeat(5000) } });
    expect(r.status).toBe(400);
  });

  it("I20. tooladvies via de mock-coach wordt gevalideerd teruggegeven", async () => {
    const r = await roep(coachRoute.POST as Handler, {
      params: { taak: "tooladvies" },
      body: { beschrijving: "Wekelijks overzicht van openstaande facturen uit AFAS", uitsluiten: [] },
    });
    expect(r.json.resultaat).toMatchObject({ tool: "hubbi" });
  });

  it("I21. uitleg alleen bij je eigen advies", async () => {
    const id = await nieuwConcept(ANNA);
    const a = (await roep(adviesRoute.POST as Handler, { body: { conceptId: id } })).json.advies;
    expect((await roep(coachRoute.POST as Handler, { gebruiker: BRAM, params: { taak: "uitleg" }, body: { adviesId: a.id } })).status).toBe(404);
    const eigen = await roep(coachRoute.POST as Handler, { params: { taak: "uitleg" }, body: { adviesId: a.id } });
    expect(eigen.json.resultaat).toContain("Eerst toetsen");
  });
});

describe("bewaartermijn", () => {
  it("I22. opruimen verwijdert verlopen adviezen en oude concepten, de rest blijft", async () => {
    const { ruimOp } = await import("@/db/opruimen");
    const id = await nieuwConcept();
    const a = (await roep(adviesRoute.POST as Handler, { body: { conceptId: id } })).json.advies;
    await nieuwConcept(BRAM);
    await db().query("UPDATE concept SET bijgewerkt_op = now() - interval '31 days' WHERE advies_id IS NULL");
    expect(await ruimOp()).toEqual({ adviezen: 0, concepten: 1, audit: 0 });
    await db().query("UPDATE advies SET verloopt_op = now() - interval '1 day' WHERE id = $1", [a.id]);
    expect((await ruimOp()).adviezen).toBe(1);
  });
});

describe("concepten: nieuw idee en hervatten", () => {
  it("I23. een nieuw idee ruimt lege en afgeronde concepten op, maar laat onafgemaakte ideeën staan", async () => {
    const onafgemaakt = await nieuwConcept(ANNA, { beschrijving: "Half idee" });
    const leeg = (await roep(conceptRoute.POST as Handler, { method: "POST" })).json.concept.id;
    const metAdvies = await nieuwConcept();
    await roep(adviesRoute.POST as Handler, { body: { conceptId: metAdvies } });
    const nieuw = (await roep(conceptRoute.POST as Handler, { method: "POST" })).json.concept.id;
    const ids = (await db().query("SELECT id FROM concept")).rows.map((r) => r.id).sort();
    expect(ids).toEqual([onafgemaakt, nieuw].sort());
    expect(ids).not.toContain(leeg);
    expect(ids).not.toContain(metAdvies);
  });

  it("I24. GET /api/concept geeft alleen het laatste onafgemaakte idee (met beschrijving, zonder advies)", async () => {
    expect((await roep(conceptRoute.GET as Handler)).json.concept).toBeNull();
    const id = await nieuwConcept(ANNA, { beschrijving: "Half idee" });
    await roep(conceptRoute.POST as Handler, { method: "POST" }); // leeg nieuw idee
    expect((await roep(conceptRoute.GET as Handler)).json.concept.id).toBe(id);
  });

  it("I25. één concept ophalen kan alleen voor je eigen concept", async () => {
    const id = await nieuwConcept(ANNA, { beschrijving: "Van Anna" });
    expect((await roep(conceptIdRoute.GET as Handler, { params: { id } })).json.concept.data.beschrijving).toBe("Van Anna");
    expect((await roep(conceptIdRoute.GET as Handler, { gebruiker: BRAM, params: { id } })).status).toBe(404);
  });
});

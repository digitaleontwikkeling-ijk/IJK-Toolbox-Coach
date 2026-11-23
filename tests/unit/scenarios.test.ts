/**
 * Verplichte testscenario's uit hoofdstuk 7 van de opdracht (1–12).
 * Checks die in een scenario niet worden genoemd, staan op het laagste antwoord (zie helpers).
 * Bij Impact is één genoemde waarde de hoogste deelscore; de andere deelvragen zijn lager.
 * Het tooladvies telt niet mee in de beslisregels; de tool staat erbij ter documentatie.
 */
import { describe, expect, it } from "vitest";
import { evalueer } from "@/domain/beslisregels";
import { invoer, regelset } from "../helpers";

const BEIDE = ["toetser_compliance", "toetser_architect"];
const B = (b: string) => ({ beschikbaarheid: b, integriteit: "nauwelijks", vertrouwelijkheid: "nauwelijks" });
const I = (i: string) => ({ beschikbaarheid: "nauwelijks", integriteit: i, vertrouwelijkheid: "nauwelijks" });
const V = (v: string) => ({ beschikbaarheid: "nauwelijks", integriteit: "nauwelijks", vertrouwelijkheid: v });

describe("testscenario's hoofdstuk 7", () => {
  it("1. Notulen van het teamoverleg automatisch laten maken (Copilot) → geel", () => {
    const u = evalueer(invoer({ checks: { data: "intern", gebruikers: "collegas", autonomie: "assisteren", impact: B("beperkt") } }), regelset);
    expect(u.kleur).toBe("geel");
    expect(u.uitkomst).toBe("Aan de slag met voorwaarden");
    expect(u.voorwaarden).toContain("Gaat je team erop vertrouwen? Wijs een eigenaar aan en documenteer.");
    expect(u.toetsers).toEqual([]);
    expect(u.dpiaSignaal).toBe(false);
    expect(u.aiActSignaal).toBe(false);
  });

  it("2. Wekelijks overzicht openstaande facturen uit AFAS in Teams (HubBI) → geel, voorwaarden leesrechten en eigenaar", () => {
    const u = evalueer(
      invoer({
        checks: { data: "intern", systemen: "lezen", gebruikers: "collegas", autonomie: "lezen", impact: I("beperkt"), afhankelijkheid: "persoonlijk" },
      }),
      regelset,
    );
    expect(u.kleur).toBe("geel");
    expect(u.voorwaarden).toEqual(
      expect.arrayContaining([
        "Gebruik de goedgekeurde koppeling en IJK-credentials met alleen leesrechten.",
        "Gaat je team erop vertrouwen? Wijs een eigenaar aan en documenteer.",
      ]),
    );
    expect(u.toetsers).toEqual([]);
  });

  it("3. Lokaal prototype met testdata, alleen voor mezelf (Claude Code) → groen", () => {
    const u = evalueer(
      invoer({
        checks: { data: "openbaar", systemen: "geen", gebruikers: "alleen_ik", autonomie: "assisteren", impact: I("nauwelijks"), afhankelijkheid: "experiment" },
      }),
      regelset,
    );
    expect(u.kleur).toBe("groen");
    expect(u.uitkomst).toBe("Direct aan de slag");
    expect(u.motivatie).toBe("Alle checks scoren groen.");
    expect(u.toetsers).toEqual([]);
  });

  it("4. Verzuimdashboard van mijn afdeling (Claude Code) → oranje, beide toetsers, DPIA-signaal", () => {
    const u = evalueer(
      invoer({
        checks: { data: "persoonsgegevens", systemen: "lezen", gebruikers: "afdeling", autonomie: "lezen", impact: B("serieus") },
        extraVragen: { bijzondere_persoonsgegevens: true },
      }),
      regelset,
    );
    expect(u.kleur).toBe("oranje");
    expect(u.toetsers).toEqual(BEIDE);
    expect(u.dpiaSignaal).toBe(true);
    expect(u.aiActSignaal).toBe(false);
    expect(u.motivatie).toBe("Persoonsgegevens (Data), Afdeling (Gebruikers) en Serieus (Impact – Beschikbaarheid).");
  });

  it("5. HR-gegevens wekelijks automatisch in AFAS verwerken (HubBI) → oranje, beide toetsers, DPIA- en AI Act-signaal", () => {
    const u = evalueer(
      invoer({
        checks: { data: "persoonsgegevens", systemen: "schrijven", gebruikers: "afdeling", autonomie: "handelen", impact: I("serieus"), afhankelijkheid: "team" },
        extraVragen: { bijzondere_persoonsgegevens: false },
      }),
      regelset,
    );
    expect(u.kleur).toBe("oranje");
    expect(u.toetsers).toEqual(BEIDE);
    expect(u.dpiaSignaal).toBe(true);
    expect(u.aiActSignaal).toBe(true);
  });

  it("6. AI beoordeelt cv's en kiest kandidaten (AI Flows) → rood, met alternatief, beide toetsers", () => {
    const u = evalueer(
      invoer({ checks: { data: "persoonsgegevens", autonomie: "beslissen", impact: I("groot") }, extraVragen: { bijzondere_persoonsgegevens: false } }),
      regelset,
    );
    expect(u.kleur).toBe("rood");
    expect(u.uitkomst).toBe("Niet op deze manier");
    expect(u.alternatieven.join(" ")).toMatch(/AI samenvatten.*recruiter.*beslissen/);
    expect(u.contactNodig).toBe(false);
    expect(u.toetsers).toEqual(BEIDE);
    expect(u.dpiaSignaal).toBe(true);
    expect(u.aiActSignaal).toBe(true);
  });

  it("7. Een tool buiten de IJK Toolbox (verder alles groen) → Eerst toetsen, door beide toetsers (regelset 0.7)", () => {
    const u = evalueer({ ...invoer(), toolBuitenToolbox: true }, regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.vervolgactie).toBe("toetsing");
    expect(u.toetsers).toEqual(BEIDE);
    expect(u.motivatie).toBe("De tool zit nog niet in de IJK Toolbox.");
    expect(u.redenen).toEqual([{ soort: "signaal", signaal: "tool_buiten_toolbox", tekst: "de tool zit nog niet in de IJK Toolbox" }]);
  });

  it("8. Een HubBI-flow logt in met een persoonlijk account (rode vlag 2) → rood", () => {
    const u = evalueer(invoer({ rodeVlaggen: { persoonlijke_inlog_of_secrets: true } }), regelset);
    expect(u.kleur).toBe("rood");
    expect(u.alternatieven).toEqual(["Gebruik IJK-credentials."]);
  });

  it("9. Alles groen, behalve Vertrouwelijkheid = Groot → rood (geen alternatief: contact volgt; DPIA-signaal)", () => {
    const u = evalueer(invoer({ checks: { impact: V("groot") } }), regelset);
    expect(u.kleur).toBe("rood");
    expect(u.motivatie).toBe("Groot (Impact – Vertrouwelijkheid).");
    expect(u.alternatieven).toEqual([]);
    expect(u.contactNodig).toBe(true);
    expect(u.dpiaSignaal).toBe(true);
    expect(u.toetsers).toEqual(BEIDE);
  });

  it("10. Alles groen, behalve Beschikbaarheid = Serieus → oranje, compliance officer", () => {
    const u = evalueer(invoer({ checks: { impact: B("serieus") } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.toetsers).toEqual(["toetser_compliance"]);
    expect(u.dpiaSignaal).toBe(false);
  });

  it("11. AI keurt zelfstandig facturen goed voor betaling → oranje, AI Act-signaal, géén DPIA-signaal", () => {
    const u = evalueer(invoer({ checks: { data: "intern", autonomie: "handelen", impact: I("serieus") } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.aiActSignaal).toBe(true);
    expect(u.dpiaSignaal).toBe(false);
    expect(u.toetsers).toEqual(["toetser_compliance"]);
  });

  it("12. Persoonlijke herinneringen in Outlook via Copilot workflows → groen, geen rode vlag voor het eigen account", () => {
    const u = evalueer(
      invoer({
        checks: { data: "intern", systemen: "geen", gebruikers: "alleen_ik", autonomie: "assisteren", impact: I("nauwelijks"), afhankelijkheid: "persoonlijk" },
        rodeVlaggen: { persoonlijke_inlog_of_secrets: false },
      }),
      regelset,
    );
    expect(u.kleur).toBe("groen");
    expect(u.redenen.filter((r) => r.soort === "rode_vlag")).toEqual([]);
    // De vraag bij rode vlag 2 legt de uitzondering voor Copilot workflows uit.
    expect(regelset.rode_vlaggen.find((v) => v.id === "persoonlijke_inlog_of_secrets")!.uitleg).toMatch(/Copilot workflows/);
  });
});

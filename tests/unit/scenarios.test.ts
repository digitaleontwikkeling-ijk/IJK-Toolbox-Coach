/**
 * Verplichte testscenario's uit hoofdstuk 7 van de opdracht.
 * Checks die in een scenario niet worden genoemd, staan op het laagste antwoord (zie helpers).
 * Het tooladvies telt niet mee in de beslisregels; de tool staat erbij ter documentatie.
 */
import { describe, expect, it } from "vitest";
import { evalueer } from "@/domain/beslisregels";
import { invoer, regelset } from "../helpers";

describe("testscenario's hoofdstuk 7", () => {
  it("1. Notulen teamoverleg automatisch laten maken (Copilot) → geel", () => {
    const u = evalueer(
      invoer({ checks: { data: "intern", gebruikers: "collegas", autonomie: "assisteren", impact: "beperkt" } }),
      regelset,
    );
    expect(u.kleur).toBe("geel");
    expect(u.uitkomst).toBe("Aan de slag met voorwaarden");
    expect(u.vervolgactie).toBe("accountaanvraag_met_voorwaarden");
    expect(u.voorwaarden).toContain("Gaat je team erop vertrouwen? Wijs een eigenaar aan en documenteer.");
    expect(u.toetsers).toEqual([]);
    expect(u.dpiaSignaal).toBe(false);
  });

  it("2. Wekelijks overzicht openstaande facturen uit AFAS in Teams (HubBI, AFAS) → geel, voorwaarden leesrechten en eigenaar", () => {
    const u = evalueer(
      invoer({
        checks: {
          data: "intern",
          systemen: "lezen",
          gebruikers: "collegas",
          autonomie: "lezen",
          impact: "beperkt",
          afhankelijkheid: "persoonlijk",
        },
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
        checks: {
          data: "openbaar",
          systemen: "geen",
          gebruikers: "alleen_ik",
          autonomie: "assisteren",
          impact: "nauwelijks",
          afhankelijkheid: "experiment",
        },
      }),
      regelset,
    );
    expect(u.kleur).toBe("groen");
    expect(u.uitkomst).toBe("Direct aan de slag");
    expect(u.vervolgactie).toBe("accountaanvraag");
    expect(u.motivatie).toBe("Alle checks scoren groen.");
    expect(u.voorwaarden).toEqual([]);
    expect(u.toetsers).toEqual([]);
  });

  it("4. Verzuimdashboard van mijn afdeling (Claude Code) → oranje, beide toetsers, DPIA-signaal", () => {
    const u = evalueer(
      invoer({
        checks: { data: "persoonsgegevens", systemen: "lezen", gebruikers: "afdeling", autonomie: "lezen", impact: "serieus" },
        extraVragen: { bijzondere_persoonsgegevens: true },
      }),
      regelset,
    );
    expect(u.kleur).toBe("oranje");
    expect(u.uitkomst).toBe("Eerst toetsen");
    expect(u.toetsers).toEqual(["toetser_compliance", "toetser_architect"]);
    expect(u.dpiaSignaal).toBe(true);
    expect(u.motivatie).toBe("Persoonsgegevens (Data), Afdeling (Gebruikers) en Serieus (Impact).");
  });

  it("5. HR-gegevens wekelijks automatisch in AFAS verwerken (HubBI) → oranje, beide toetsers, DPIA-signaal", () => {
    const u = evalueer(
      invoer({
        checks: {
          data: "persoonsgegevens",
          systemen: "schrijven",
          gebruikers: "afdeling",
          autonomie: "handelen",
          impact: "serieus",
          afhankelijkheid: "team",
        },
        extraVragen: { bijzondere_persoonsgegevens: false },
      }),
      regelset,
    );
    expect(u.kleur).toBe("oranje");
    expect(u.vervolgactie).toBe("toetsing");
    expect(u.toetsers).toEqual(["toetser_compliance", "toetser_architect"]);
    expect(u.dpiaSignaal).toBe(true);
  });

  it("6. AI beoordeelt cv's en kiest kandidaten (AI Flows) → rood, met alternatief", () => {
    const u = evalueer(
      invoer({
        checks: { data: "persoonsgegevens", autonomie: "beslissen", impact: "groot" },
        extraVragen: { bijzondere_persoonsgegevens: false },
      }),
      regelset,
    );
    expect(u.kleur).toBe("rood");
    expect(u.uitkomst).toBe("Niet op deze manier");
    expect(u.vervolgactie).toBe("alleen_vastleggen");
    expect(u.toetsers).toEqual([]);
    expect(u.alternatieven.join(" ")).toMatch(/AI samenvatten.*recruiter.*beslissen/);
    expect(u.motivatie).toBe("Beslissen (over mensen) (Autonomie) en Groot (Impact).");
    // Persoonsgegevens + beslissen: het DPIA-signaal wordt wel getoond.
    expect(u.dpiaSignaal).toBe(true);
  });

  it("7. Klantgegevens in een gratis AI-tool plakken (rode vlag 1) → rood", () => {
    const u = evalueer(invoer({ rodeVlaggen: { niet_goedgekeurde_tool: true } }), regelset);
    expect(u.kleur).toBe("rood");
    expect(u.redenen).toEqual([{ soort: "rode_vlag", vlagId: "niet_goedgekeurde_tool", kort: expect.any(String) }]);
    expect(u.motivatie).toBe("Rode vlag: een tool die IJK niet heeft goedgekeurd.");
    expect(u.alternatieven.length).toBeGreaterThan(0);
  });

  it("8. Flow logt in met persoonlijk account (rode vlag 2) → rood", () => {
    const u = evalueer(invoer({ rodeVlaggen: { persoonlijke_inlog_of_secrets: true } }), regelset);
    expect(u.kleur).toBe("rood");
    expect(u.vervolgactie).toBe("alleen_vastleggen");
    expect(u.redenen.map((r) => r.soort)).toEqual(["rode_vlag"]);
  });
});

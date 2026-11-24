/**
 * Regelset 0.8: privacy (pre-DPIA) en AI-risico, geïntegreerd in de checks.
 * Scenario's 1–15 uit de opdracht "Privacy/DPIA- en AI-risicoclassificatie integreren" (16 = toegankelijkheid: e2e).
 */
import { describe, expect, it } from "vitest";
import { evalueer, OngeldigeInvoerFout, type BeslisInvoer } from "@/domain/beslisregels";
import { beslisInvoerUit } from "@/domain/invoer";
import { analyseer, type Feit } from "@/domain/verdieping";
import { wizardDataSchema } from "@/domain/wizard";
import { content, invoer, regelset } from "../helpers";

const BEIDE = ["toetser_compliance", "toetser_architect"];
const vragen = (i: BeslisInvoer) => analyseer(i, regelset).vragen.map((v) => v.gegeven.id);
const feit = (i: BeslisInvoer, id: string) => analyseer(i, regelset).feiten.find((f) => f.id === id);
const fouten = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (e) {
    if (e instanceof OngeldigeInvoerFout) return e.fouten;
    throw e;
  }
  throw new Error("verwachtte een fout");
};
const PG = { data: "persoonsgegevens" };
const NIET_BIJZONDER = { bijzondere_persoonsgegevens: false };

describe("scenario's", () => {
  it("1. eenvoudig prototype (testdata, alleen ik, geen AI): alleen de AI-vraag, geen DPIA, geen AI-beoordeling", () => {
    const i = invoer();
    expect(vragen(i)).toEqual(["ai_gebruik"]);
    const u = evalueer(i, regelset);
    expect(u.kleur).toBe("groen");
    expect(u.dpia.actief).toBe(false);
    expect(u.aiRisico.actief).toBe(false);
  });

  it("2. persoonsgegevens zonder AI: privacyvragen, geen AI-vragen; Data en de extra vraag worden hergebruikt", () => {
    const i = invoer({ checks: PG, extraVragen: NIET_BIJZONDER });
    const v = vragen(i);
    expect(v).toEqual(expect.arrayContaining(["kwetsbare_groepen", "grote_schaal", "profilering", "significante_gevolgen"]));
    expect(v.filter((x) => x.startsWith("ai_") && x !== "ai_gebruik")).toEqual([]);
    // Geen vraag "Gebruik je persoonsgegevens?" of "bijzondere persoonsgegevens?" opnieuw.
    expect(regelset.gegevens.map((g) => g.id)).not.toContain("bijzondere_persoonsgegevens");
    expect(feit(i, "persoonsgegevens")).toMatchObject({ waarde: "ja", bron: "check.data", herkomst: "expliciet" });
    const u = evalueer(i, regelset);
    expect(u.dpia.indicatoren.find((x) => x.id === "bijzondere_persoonsgegevens")!.feit.bron).toBe("extra_vraag.bijzondere_persoonsgegevens");
    expect(u.aiRisico.actief).toBe(false);
  });

  it("3. AI zonder persoonsgegevens: geen DPIA alleen vanwege AI, wel een AI-beoordeling", () => {
    const u = evalueer(invoer({ checks: { autonomie: "assisteren" }, verdieping: { ai_gebruik: "ja" } }), regelset);
    expect(u.dpia.actief).toBe(false);
    expect(u.aiRisico).toMatchObject({ actief: true, klasse: "laag" });
  });

  it("4. AI verwerkt persoonsgegevens: beide beoordelingen; de AI-vraag wordt één keer gesteld en telt voor allebei", () => {
    const i = invoer({ checks: { ...PG, autonomie: "assisteren" }, extraVragen: NIET_BIJZONDER, verdieping: { ai_gebruik: "ja" } });
    expect(vragen(i).filter((x) => x === "ai_gebruik")).toHaveLength(1);
    const u = evalueer(i, regelset);
    expect(u.dpia.actief && u.aiRisico.actief).toBe(true);
    const ai = u.dpia.indicatoren.find((x) => x.id === "ai_gebruik")!;
    expect(ai).toMatchObject({ telt: true, feit: { bron: "verdieping.ai_gebruik", gebruiktDoor: ["dpia", "ai"] } });
  });

  it("5. AI adviseert over personen, een mens beslist: Autonomie wordt hergebruikt, alleen ontbrekende AI-vragen", () => {
    const i = invoer({
      checks: { ...PG, autonomie: "adviseren" },
      extraVragen: NIET_BIJZONDER,
      verdieping: { ai_gebruik: "ja", ai_invloed: "indirect", ai_doorslaggevend: "nee" },
    });
    const a = analyseer(i, regelset);
    // "Besluit de oplossing zelf?" volgt uit Autonomie (alleen adviseren): niet vragen.
    expect(a.vragen.map((v) => v.gegeven.id)).not.toContain("geautomatiseerd_besluit");
    expect(a.feiten.find((f) => f.id === "geautomatiseerd_besluit")).toMatchObject({ waarde: "nee", herkomst: "afgeleid", bron: "check.autonomie" });
    // Invloed en gewicht: gerichte verduidelijking (signaal uit "Adviseren").
    expect(a.vragen.find((v) => v.gegeven.id === "ai_invloed")!.signaal).toBe(true);
    expect(a.vragen.find((v) => v.gegeven.id === "ai_doorslaggevend")!.signaal).toBe(true);
    const u = evalueer(i, regelset);
    expect(u.aiRisico.klasse).toBe("laag");
  });

  it("6. AI beslist zelfstandig over personen: hoog AI-risico, rood, beide toetsers, traceerbare reden", () => {
    const u = evalueer(
      invoer({
        checks: { ...PG, autonomie: "beslissen" },
        extraVragen: NIET_BIJZONDER,
        rodeVlaggen: { ai_beslist_over_mensen: true },
        verdieping: { ai_gebruik: "ja" },
      }),
      regelset,
    );
    expect(u.aiRisico.klasse).toBe("hoog");
    expect(u.kleur).toBe("rood");
    expect(u.toetsers).toEqual(BEIDE);
    const reden = u.aiRisico.redenen.find((r) => r.gegeven === "ai_invloed")!;
    expect(reden.feit).toMatchObject({ waarde: "direct", herkomst: "afgeleid", bron: "check.autonomie" });
    expect(reden.feit.toelichting).toContain("Beslissen (over mensen)");
    // Significante gevolgen volgen uit de aanvullende vraag ("met grote gevolgen").
    expect(u.dpia.indicatoren.find((x) => x.id === "significante_gevolgen")!.feit.bron).toBe("rode_vlag.ai_beslist_over_mensen");
  });

  it("7. persoonsgegevens, koppeling en teamoplossing: privacy- en architectuurroute, geen dubbele vragen", () => {
    const i = invoer({
      checks: { ...PG, systemen: "koppelen", afhankelijkheid: "team" },
      extraVragen: NIET_BIJZONDER,
      verdieping: { koppeling_datasets: "ja", grote_schaal: "ja" },
    });
    const a = analyseer(i, regelset);
    expect(a.vragen.find((v) => v.gegeven.id === "koppeling_datasets")!.signaal).toBe(true);
    expect(a.vragen.find((v) => v.gegeven.id === "grote_schaal")!.signaal).toBe(true);
    // Elke vraag hooguit één keer.
    const ids = a.vragen.map((v) => v.gegeven.id);
    expect(new Set(ids).size).toBe(ids.length);
    const u = evalueer(i, regelset);
    expect(u.toetsers).toEqual(BEIDE);
    expect(u.dpia.klasse).toBe("waarschijnlijk");
  });

  it("8. van persoonsgegevens naar openbaar: de privacyvragen verdwijnen en oude antwoorden tellen niet meer", () => {
    const met = { checks: { ...PG }, extraVragen: NIET_BIJZONDER, verdieping: { kwetsbare_groepen: "ja", grote_schaal: "ja" } };
    expect(evalueer(invoer(met), regelset).dpia.klasse).toBe("waarschijnlijk");
    const zonder = invoer({ ...met, checks: { data: "openbaar" } });
    expect(vragen(zonder)).toEqual(["ai_gebruik"]);
    const u = evalueer(zonder, regelset);
    expect(u.dpia.actief).toBe(false);
    expect(u.kleur).toBe("groen");
    // Het register krijgt alleen relevante antwoorden.
    const data = wizardDataSchema.parse({ checks: zonder.checks, rodeVlaggen: zonder.rodeVlaggen, verdieping: zonder.verdieping });
    expect(beslisInvoerUit(data, content).verdieping).toEqual({ ai_gebruik: "nee" });
  });

  it("9. van alleen ik naar extern: nieuwe kleur en een extra AI-vraag over informeren", () => {
    const basis = { checks: { autonomie: "assisteren" }, verdieping: { ai_gebruik: "ja" } };
    expect(vragen(invoer(basis))).not.toContain("ai_transparantie");
    const extern = invoer({ ...basis, checks: { ...basis.checks, gebruikers: "extern" }, verdieping: { ai_gebruik: "ja", ai_transparantie: "gedeeltelijk" } });
    expect(vragen(extern)).toContain("ai_transparantie");
    const u = evalueer(extern, regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.aiRisico.klasse).toBe("beperkt");
    expect(u.toetsers).toEqual(["toetser_architect"]);
  });

  it("10. één antwoord voedt drie beoordelingen (Autonomie = Beslissen)", () => {
    const i = invoer({ checks: { ...PG, autonomie: "beslissen" }, extraVragen: NIET_BIJZONDER, verdieping: { ai_gebruik: "ja" } });
    const autonomie = feit(i, "check.autonomie") as Feit;
    expect(autonomie.gebruiktDoor.sort()).toEqual(["ai", "dpia", "toolbox"]);
    // Eén opgeslagen feit, meerdere afgeleide feiten met dezelfde bron.
    const a = analyseer(i, regelset);
    expect(a.feiten.filter((f) => f.bron === "check.autonomie" && f.herkomst === "afgeleid").map((f) => f.id).sort()).toEqual([
      "ai_doorslaggevend",
      "ai_invloed",
      "geautomatiseerd_besluit",
      "profilering",
    ]);
  });

  it("11. eerst beperkt, later hoog AI-risico", () => {
    const basis = { checks: { autonomie: "adviseren" }, verdieping: { ai_gebruik: "ja", ai_invloed: "indirect", ai_toezicht: "incidenteel" } };
    expect(evalueer(invoer(basis), regelset).aiRisico.klasse).toBe("beperkt");
    const later = evalueer(invoer({ ...basis, verdieping: { ...basis.verdieping, ai_discriminatie: "ja" } }), regelset);
    expect(later.aiRisico.klasse).toBe("hoog");
    expect(later.kleur).toBe("oranje");
  });

  it("12. hoog risico wordt niet verlaagd door latere geruststellende antwoorden", () => {
    const u = evalueer(
      invoer({
        checks: { autonomie: "adviseren" },
        verdieping: { ai_gebruik: "ja", ai_invloed: "indirect", ai_herziening: "nee", ai_transparantie: "ja", ai_toezicht: "structureel", ai_uitlegbaarheid: "goed" },
      }),
      regelset,
    );
    expect(u.aiRisico.klasse).toBe("hoog");
    expect(u.aiRisico.redenen.map((r) => r.gegeven)).toEqual(["ai_herziening"]);
  });

  it("13. terug en wijzigen: afhankelijke vragen verdwijnen, en een eerder antwoord komt terug als de vraag weer relevant is", () => {
    const verdieping = { ai_gebruik: "ja", ai_invloed: "indirect", ai_doorslaggevend: "mede" };
    expect(vragen(invoer({ checks: { autonomie: "adviseren" }, verdieping }))).toContain("ai_doorslaggevend");
    // Alleen assisteren: de AI raakt niemand → de vragen over betrokkenen vallen weg (B5).
    expect(vragen(invoer({ checks: { autonomie: "assisteren" }, verdieping }))).not.toContain("ai_doorslaggevend");
    const terug = analyseer(invoer({ checks: { autonomie: "adviseren" }, verdieping }), regelset);
    expect(terug.vragen.find((v) => v.gegeven.id === "ai_doorslaggevend")!.antwoord).toBe("mede");
  });

  it("14. gedeeltelijk herbruikbare informatie: een verduidelijking (met inleiding), niet nog eens de oorspronkelijke vraag", () => {
    const a = analyseer(invoer({ checks: { ...PG, impact: { integriteit: "groot" } }, extraVragen: NIET_BIJZONDER }), regelset);
    const v = a.vragen.find((x) => x.gegeven.id === "significante_gevolgen")!;
    expect(v.signaal).toBe(true);
    expect(v.gegeven.signaal).toMatch(/serieus of groot/);
    // "Groot" wordt niet automatisch "grote gevolgen voor mensen": het feit komt uit het antwoord, niet uit Impact.
    expect(a.feiten.find((f) => f.id === "significante_gevolgen")).toMatchObject({ herkomst: "expliciet", bron: "verdieping.significante_gevolgen" });
  });

  it("15. traceerbaarheid: elke indicator en elke AI-reden heeft een feit met bron, herkomst en toelichting", () => {
    const u = evalueer(
      invoer({
        checks: { ...PG, systemen: "geen", autonomie: "beslissen" },
        extraVragen: { bijzondere_persoonsgegevens: true },
        verdieping: { ai_gebruik: "ja" },
      }),
      regelset,
    );
    for (const f of [...u.dpia.indicatoren.map((i) => i.feit), ...u.aiRisico.redenen.map((r) => r.feit)]) {
      expect(f.bron).toMatch(/^(check|verdieping|extra_vraag|rode_vlag)\./);
      expect(["expliciet", "afgeleid"]).toContain(f.herkomst);
      expect(f.toelichting.length).toBeGreaterThan(0);
    }
    expect(u.dpia.indicatoren.find((x) => x.id === "koppeling_datasets")!.feit).toMatchObject({ waarde: "nee", bron: "check.systemen" });
    expect(u.dpia.score).toBe(4); // profilering, besluit, bijzonder, AI
    // De klasse staat ook in "Waarom deze kleur?" niet als enige informatie: de uitkomst is rood door Beslissen.
    expect(u.motivatie).toContain("Beslissen (over mensen)");
  });
});

describe("privacy-telling", () => {
  const met = (verdieping: Record<string, string>, bijzonder = false) =>
    evalueer(invoer({ checks: PG, extraVragen: { bijzondere_persoonsgegevens: bijzonder }, verdieping }), regelset);

  it("P1. 0 of 1 indicator: geen volledige DPIA; 2: waarschijnlijk (oranje + compliance); 3 of meer: verplicht", () => {
    expect(met({}).dpia).toMatchObject({ score: 0, klasse: "geen" });
    expect(met({}, true).dpia).toMatchObject({ score: 1, klasse: "geen" });
    expect(met({ grote_schaal: "ja" }, true).dpia).toMatchObject({ score: 2, klasse: "waarschijnlijk" });
    expect(met({ grote_schaal: "ja", kwetsbare_groepen: "ja" }, true).dpia).toMatchObject({ score: 3, klasse: "verplicht" });
  });

  it("P2. 'weet ik niet zeker' telt als indicator", () => {
    expect(met({ grote_schaal: "weet_niet", kwetsbare_groepen: "weet_niet" }).dpia).toMatchObject({ score: 2, klasse: "waarschijnlijk" });
  });

  it("P2b. bijzondere persoonsgegevens 'weet ik niet zeker': telt als indicator, met herkomst", () => {
    const u = evalueer(invoer({ checks: PG, extraVragen: { bijzondere_persoonsgegevens: "onzeker" }, verdieping: { grote_schaal: "ja" } }), regelset);
    const i = u.dpia.indicatoren.find((x) => x.id === "bijzondere_persoonsgegevens")!;
    expect(i).toMatchObject({ waarde: "weet_niet", telt: true, feit: { bron: "extra_vraag.bijzondere_persoonsgegevens" } });
    expect(u.dpia.klasse).toBe("waarschijnlijk");
  });

  it("P2c. 'weet ik niet zeker' alleen bij extra vragen die dat toestaan", () => {
    const r = structuredClone(regelset);
    r.extra_vragen.find((e) => e.id === "bijzondere_persoonsgegevens")!.onzeker_mogelijk = false;
    expect(fouten(() => evalueer(invoer({ checks: PG, extraVragen: { bijzondere_persoonsgegevens: "onzeker" } }, r), r))).toContain(
      'extra vraag "bijzondere_persoonsgegevens" is niet beantwoord',
    );
  });

  it("P3. Data = Weet ik niet zeker: oranje en het privacyspoor start (B1)", () => {
    const i = invoer({ checks: { data: "weet_niet" }, extraVragen: NIET_BIJZONDER });
    expect(feit(i, "persoonsgegevens")!.waarde).toBe("onzeker");
    const u = evalueer(i, regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.dpia.actief).toBe(true);
    // De extra vraag over bijzondere persoonsgegevens geldt ook bij twijfel.
    expect(fouten(() => evalueer(invoer({ checks: { data: "weet_niet" } }), regelset))).toContain(
      'extra vraag "bijzondere_persoonsgegevens" is niet beantwoord',
    );
  });

  it("P4. DPIA 'waarschijnlijk' verhoogt geel naar oranje en noemt de reden", () => {
    const r = structuredClone(regelset);
    r.checks.find((c) => c.id === "data")!.antwoorden.find((a) => a.id === "persoonsgegevens")!.kleur = "geel";
    const u = evalueer(
      invoer({ checks: PG, extraVragen: { bijzondere_persoonsgegevens: true }, verdieping: { grote_schaal: "ja" } }, r),
      r,
    );
    expect(u.kleur).toBe("oranje");
    expect(u.motivatie).toBe("Waarschijnlijk volledige DPIA nodig (2 privacy-indicatoren).");
    expect(u.toetsers).toEqual(["toetser_compliance"]);
  });
});

describe("AI-risico", () => {
  const ai = (verdieping: Record<string, string>, checks: Record<string, string> = { autonomie: "adviseren" }) =>
    evalueer(invoer({ checks, verdieping: { ai_gebruik: "ja", ai_invloed: "indirect", ...verdieping } }), regelset);

  it.each([
    ["ai_invloed", "direct", "hoog"],
    ["ai_discriminatie", "ja", "hoog"],
    ["ai_herziening", "nee", "hoog"],
    ["ai_doorslaggevend", "doorslaggevend", "hoog"],
    ["ai_transparantie", "nee", "hoog"],
    ["ai_transparantie", "gedeeltelijk", "beperkt"],
    ["ai_toezicht", "nee", "hoog"],
    ["ai_toezicht", "incidenteel", "beperkt"],
    ["ai_uitlegbaarheid", "niet", "hoog"],
    ["ai_uitlegbaarheid", "beperkt", "beperkt"],
    ["ai_uitlegbaarheid", "onbekend", "beperkt"],
    ["ai_discriminatie", "mogelijk", "laag"],
    ["ai_herziening", "onzeker", "laag"],
    ["ai_doorslaggevend", "mede", "laag"],
  ])("AI1. %s = %s → %s", (gegeven, antwoord, klasse) => {
    expect(ai({ [gegeven]: antwoord }).aiRisico.klasse).toBe(klasse);
  });

  it("AI2. beperkt → minstens geel, met de voorwaarde bij het antwoord", () => {
    const u = ai({ ai_uitlegbaarheid: "beperkt" });
    expect(u.kleur).toBe("geel");
    expect(u.voorwaarden).toEqual([expect.stringMatching(/Controleer de uitkomsten van de AI zelf/)]);
    expect(u.motivatie).toBe("Beperkt risico bij het gebruik van AI.");
  });

  it("AI3. hoog → minstens oranje, compliance officer, AI Act-signaal", () => {
    const u = ai({ ai_discriminatie: "ja" });
    expect(u.kleur).toBe("oranje");
    expect(u.toetsers).toEqual(["toetser_compliance"]);
    expect(u.aiActSignaal).toBe(true);
  });

  it("AI4. de AI raakt geen mensen: alleen de vragen over AI-gebruik, invloed en uitlegbaarheid (B5)", () => {
    expect(vragen(invoer({ checks: { autonomie: "handelen" }, verdieping: { ai_gebruik: "ja", ai_invloed: "nee" } }))).toEqual([
      "ai_gebruik",
      "ai_invloed",
      "ai_uitlegbaarheid",
    ]);
  });

  it("AI5. AI 'weet ik niet zeker': voor de zekerheid het AI-spoor, en het telt als privacy-indicator", () => {
    const u = evalueer(
      invoer({ checks: { ...PG, autonomie: "assisteren" }, extraVragen: NIET_BIJZONDER, verdieping: { ai_gebruik: "weet_niet" } }),
      regelset,
    );
    expect(u.aiRisico.actief).toBe(true);
    expect(u.dpia.indicatoren.find((i) => i.id === "ai_gebruik")!.telt).toBe(true);
  });

  it("AI6. zonder AI geen AI-vragen en geen AI-beoordeling, ook niet bij Handelen (B3)", () => {
    const i = invoer({ checks: { autonomie: "handelen" }, verdieping: { ai_gebruik: "nee", ai_discriminatie: "ja" } });
    expect(vragen(i)).toEqual(["ai_gebruik"]);
    expect(evalueer(i, regelset).aiActSignaal).toBe(false);
  });
});

describe("invoercontrole", () => {
  it("IV1. ontbrekende relevante vragen worden gemeld; overbodige antwoorden niet", () => {
    const i = invoer({ checks: PG, extraVragen: NIET_BIJZONDER });
    delete i.verdieping!.kwetsbare_groepen;
    delete i.verdieping!.ai_toezicht; // niet relevant: geen fout
    expect(fouten(() => evalueer(i, regelset))).toEqual(['vraag "kwetsbare_groepen" is niet beantwoord']);
  });

  it("IV2. de AI-vraag is altijd nodig", () => {
    const i = invoer();
    delete i.verdieping!.ai_gebruik;
    expect(fouten(() => evalueer(i, regelset))).toEqual(['vraag "ai_gebruik" is niet beantwoord']);
  });

  it("IV3. onbekende vraag of ongeldig antwoord wordt geweigerd", () => {
    expect(fouten(() => evalueer(invoer({ verdieping: { verzonnen: "ja" } }), regelset))).toContain('onbekende vraag "verzonnen"');
    expect(fouten(() => evalueer(invoer({ verdieping: { ai_gebruik: "misschien" } }), regelset))).toContain(
      'ongeldig antwoord "misschien" bij vraag "ai_gebruik"',
    );
  });
});

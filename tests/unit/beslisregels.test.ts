/**
 * Randgevallen van de beslisregels (aanvulling op de scenario's uit hoofdstuk 7).
 */
import { describe, expect, it } from "vitest";
import { evalueer, OngeldigeInvoerFout, valideerInvoer } from "@/domain/beslisregels";
import { invoer, kopieRegelset, regelset } from "../helpers";

function fouten(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof OngeldigeInvoerFout) return e.fouten;
    throw e;
  }
  throw new Error("verwachtte een OngeldigeInvoerFout");
}

describe("invoercontrole", () => {
  it("R1. ontbrekend antwoord op een check geeft een fout, geen stille aanname", () => {
    const i = invoer();
    delete i.checks.gebruikers;
    expect(fouten(() => evalueer(i, regelset))).toEqual(['check "gebruikers" is niet beantwoord']);
  });

  it("R2. leeg antwoord telt als niet beantwoord", () => {
    const i = invoer({ checks: { data: "" } });
    expect(fouten(() => evalueer(i, regelset))).toEqual(['check "data" is niet beantwoord']);
  });

  it("R3. ongeldige waarde (bijv. verzonnen door de coach) wordt geweigerd", () => {
    const i = invoer({ checks: { autonomie: "zelfstandig_alles" } });
    expect(fouten(() => evalueer(i, regelset))).toEqual(['ongeldig antwoord "zelfstandig_alles" bij check "autonomie"']);
  });

  it("R4. onbekende check wordt geweigerd", () => {
    const i = invoer();
    i.checks.budget = "hoog";
    expect(fouten(() => evalueer(i, regelset))).toContain('onbekende check "budget"');
  });

  it("R5. een rode vlag die niet is beantwoord geeft een fout", () => {
    const i = invoer();
    delete i.rodeVlaggen.open_zonder_toetsing;
    expect(fouten(() => evalueer(i, regelset))).toEqual(['rode vlag "open_zonder_toetsing" is niet beantwoord']);
  });

  it("R6. onbekende rode vlag wordt geweigerd", () => {
    const i = invoer();
    i.rodeVlaggen.verzonnen_vlag = true;
    expect(fouten(() => evalueer(i, regelset))).toContain('onbekende rode vlag "verzonnen_vlag"');
  });

  it("R7. bij persoonsgegevens moet de vraag over bijzondere persoonsgegevens beantwoord zijn", () => {
    const i = invoer({ checks: { data: "persoonsgegevens" } });
    expect(fouten(() => evalueer(i, regelset))).toEqual(['extra vraag "bijzondere_persoonsgegevens" is niet beantwoord']);
  });

  it("R8. zonder persoonsgegevens is de extra vraag niet nodig", () => {
    expect(valideerInvoer(invoer({ checks: { data: "intern" } }), regelset)).toEqual([]);
  });

  it("R9. meerdere fouten worden allemaal tegelijk gemeld", () => {
    const i = invoer({ checks: { data: "onzin" } });
    delete i.checks.gebruikers;
    delete i.rodeVlaggen.niet_goedgekeurde_tool;
    expect(fouten(() => evalueer(i, regelset))).toHaveLength(3);
  });
});

describe("hoogste kleur en motivatie", () => {
  it("R10. één rode vlag maakt een verder volledig groen advies rood", () => {
    const u = evalueer(invoer({ rodeVlaggen: { open_zonder_toetsing: true } }), regelset);
    expect(u.kleur).toBe("rood");
    // Bij rood kijken beide toetsers mee (opdracht §4.4).
    expect(u.toetsers).toEqual(["toetser_compliance", "toetser_architect"]);
    expect(u.voorwaarden).toEqual([]);
  });

  it("R11. rode vlag én rode check: de motivatie noemt ze allebei, vlaggen eerst", () => {
    const u = evalueer(
      invoer({
        checks: { impact: "groot" },
        rodeVlaggen: { niet_goedgekeurde_tool: true, persoonlijke_inlog_of_secrets: true },
      }),
      regelset,
    );
    expect(u.redenen.map((r) => (r.soort === "check" ? r.checkId : r.vlagId))).toEqual([
      "niet_goedgekeurde_tool",
      "persoonlijke_inlog_of_secrets",
      "impact",
    ]);
    expect(u.motivatie).toBe(
      "Een tool die IJK niet heeft goedgekeurd, een persoonlijke inlog of wachtwoorden/API-keys in de code en Groot (Impact – Integriteit).",
    );
  });

  it("R12. bij rood worden alternatieven niet dubbel getoond", () => {
    const u = evalueer(
      invoer({
        checks: { data: "persoonsgegevens", autonomie: "beslissen" },
        extraVragen: { bijzondere_persoonsgegevens: false },
        rodeVlaggen: { ai_beslist_over_mensen: true },
      }),
      regelset,
    );
    expect(u.alternatieven).toHaveLength(1);
  });

  it("R13. alleen de checks met de hoogste kleur geven de doorslag", () => {
    const u = evalueer(invoer({ checks: { systemen: "koppelen", gebruikers: "collegas", impact: "beperkt" } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.motivatie).toBe("Koppelen (Systemen).");
  });

  it("R14. voorwaarden worden alleen bij geel getoond, niet als de uitkomst oranje is", () => {
    const u = evalueer(invoer({ checks: { systemen: "lezen", afhankelijkheid: "team" } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.voorwaarden).toEqual([]);
  });

  it("R15. de regelversie wordt altijd meegegeven", () => {
    expect(evalueer(invoer(), regelset).regelversie).toBe(regelset.versie);
  });
});

describe("toetsers en DPIA-signaal", () => {
  it("R16. alleen oranje op Systemen/Gebruikers/Afhankelijkheid → alleen de architect", () => {
    const u = evalueer(invoer({ checks: { systemen: "koppelen", gebruikers: "organisatie", afhankelijkheid: "bedrijf" } }), regelset);
    expect(u.toetsers).toEqual(["toetser_architect"]);
    expect(u.dpiaSignaal).toBe(false);
  });

  it("R17. alleen oranje op Data/Autonomie/Impact → alleen de compliance officer", () => {
    const u = evalueer(invoer({ checks: { data: "vertrouwelijk", autonomie: "schrijven", impact: "serieus" } }), regelset);
    expect(u.toetsers).toEqual(["toetser_compliance"]);
    expect(u.dpiaSignaal).toBe(false);
  });

  it("R18. persoonsgegevens zonder verzwarende situatie → geen DPIA-signaal", () => {
    const u = evalueer(
      invoer({ checks: { data: "persoonsgegevens", gebruikers: "collegas" }, extraVragen: { bijzondere_persoonsgegevens: false } }),
      regelset,
    );
    expect(u.kleur).toBe("oranje");
    expect(u.dpiaSignaal).toBe(false);
    expect(u.toetsers).toEqual(["toetser_compliance"]);
  });

  it.each([
    ["bijzondere persoonsgegevens", {}, { bijzondere_persoonsgegevens: true }],
    ["autonomie = handelen", { autonomie: "handelen" }, {}],
    ["autonomie = beslissen", { autonomie: "beslissen" }, {}],
    ["gebruikers = organisatie", { gebruikers: "organisatie" }, {}],
    ["gebruikers = extern", { gebruikers: "extern" }, {}],
    ["impact = serieus", { impact: "serieus" }, {}],
    ["impact = groot", { impact: "groot" }, {}],
  ])("R19. persoonsgegevens + %s → DPIA-signaal", (_naam, checks, extra) => {
    const u = evalueer(
      invoer({
        checks: { data: "persoonsgegevens", ...checks },
        extraVragen: { bijzondere_persoonsgegevens: false, ...extra },
      }),
      regelset,
    );
    expect(u.dpiaSignaal).toBe(true);
  });

  it("R20. zonder persoonsgegevens nooit een DPIA-signaal, ook niet bij grote impact", () => {
    const u = evalueer(
      invoer({ checks: { data: "vertrouwelijk", impact: "groot", autonomie: "handelen" }, extraVragen: { bijzondere_persoonsgegevens: true } }),
      regelset,
    );
    expect(u.dpiaSignaal).toBe(false);
  });

  it("R21. bij een DPIA-signaal gaat de toetsing ook naar compliance, zelfs als Data niet oranje scoort", () => {
    // Fictieve regelset waarin persoonsgegevens geel scoort: laat zien dat de DPIA-regel apart werkt.
    const r = kopieRegelset();
    r.checks.find((c) => c.id === "data")!.antwoorden.find((a) => a.id === "persoonsgegevens")!.kleur = "geel";
    const u = evalueer(
      invoer({ checks: { data: "persoonsgegevens", gebruikers: "organisatie" }, extraVragen: { bijzondere_persoonsgegevens: false } }, r),
      r,
    );
    expect(u.kleur).toBe("oranje");
    expect(u.dpiaSignaal).toBe(true);
    expect(u.toetsers).toEqual(["toetser_compliance", "toetser_architect"]);
  });
});

describe("eigenschappen van de functie", () => {
  it("R22. de functie past de invoer en de regelset niet aan", () => {
    const i = invoer({ checks: { data: "persoonsgegevens" }, extraVragen: { bijzondere_persoonsgegevens: true } });
    const r = kopieRegelset();
    const iVoor = structuredClone(i);
    const rVoor = structuredClone(r);
    evalueer(i, r);
    expect(i).toEqual(iVoor);
    expect(r).toEqual(rVoor);
  });

  it("R23. dezelfde invoer geeft altijd dezelfde uitkomst", () => {
    const i = invoer({ checks: { systemen: "lezen", gebruikers: "collegas" } });
    expect(evalueer(i, regelset)).toEqual(evalueer(i, regelset));
  });

  it("R24. opnieuw doorlopen na een wijziging: dezelfde antwoorden met één aanpassing geven een nieuwe uitkomst", () => {
    const vorige = invoer({ checks: { data: "intern", systemen: "lezen", gebruikers: "alleen_ik" } });
    expect(evalueer(vorige, regelset).kleur).toBe("geel");
    // "Er is iets veranderd": de oplossing wordt nu door de hele afdeling gebruikt.
    const gewijzigd = { ...vorige, checks: { ...vorige.checks, gebruikers: "afdeling" } };
    const u = evalueer(gewijzigd, regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.toetsers).toEqual(["toetser_architect"]);
  });

  it("R25. de uitkomst volgt de configuratie, niet de code (kleur aangepast in de regelset)", () => {
    const r = kopieRegelset();
    r.versie = "0.2-test";
    r.checks.find((c) => c.id === "gebruikers")!.antwoorden.find((a) => a.id === "collegas")!.kleur = "oranje";
    const u = evalueer(invoer({ checks: { gebruikers: "collegas" } }, r), r);
    expect(u.kleur).toBe("oranje");
    expect(u.regelversie).toBe("0.2-test");
  });

  it("R26. teksten komen uit de configuratie (uitkomstnaam aangepast)", () => {
    const r = kopieRegelset();
    r.kleuren[0]!.uitkomst = "Ga je gang";
    expect(evalueer(invoer({}, r), r).uitkomst).toBe("Ga je gang");
  });
});

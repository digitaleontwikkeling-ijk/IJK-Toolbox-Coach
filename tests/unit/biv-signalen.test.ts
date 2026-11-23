/**
 * Randgevallen bij Impact (BIV), het DPIA- en AI Act-signaal, toetsers bij rood en
 * "contact volgt" (opdracht §4.2a, §4.4, §4.5).
 */
import { describe, expect, it } from "vitest";
import { evalueer, OngeldigeInvoerFout } from "@/domain/beslisregels";
import { invoer, kopieRegelset, regelset } from "../helpers";

const BEIDE = ["toetser_compliance", "toetser_architect"];
const fouten = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (e) {
    if (e instanceof OngeldigeInvoerFout) return e.fouten;
    throw e;
  }
  throw new Error("verwachtte een fout");
};

describe("Impact in drie deelvragen", () => {
  it("V1. een ontbrekende deelvraag geeft een fout", () => {
    const i = invoer();
    delete (i.checks.impact as Record<string, string>).vertrouwelijkheid;
    expect(fouten(() => evalueer(i, regelset))).toEqual(['deelvraag "impact.vertrouwelijkheid" is niet beantwoord']);
  });

  it("V2. een ongeldige waarde bij een deelvraag wordt geweigerd", () => {
    const i = invoer({ checks: { impact: { beschikbaarheid: "catastrofaal" } } });
    expect(fouten(() => evalueer(i, regelset))).toEqual(['ongeldig antwoord "catastrofaal" bij deelvraag "impact.beschikbaarheid"']);
  });

  it("V3. een onbekende deelvraag wordt geweigerd", () => {
    const i = invoer({ checks: { impact: { schaalbaarheid: "groot" } } });
    expect(fouten(() => evalueer(i, regelset))).toContain('onbekende deelvraag "impact.schaalbaarheid"');
  });

  it("V4. één losse waarde bij Impact wordt geweigerd: er is een antwoord per deelvraag nodig", () => {
    const i = invoer();
    i.checks.impact = "serieus";
    expect(fouten(() => evalueer(i, regelset))).toEqual(['check "impact" verwacht een antwoord per deelvraag']);
  });

  it("V5. deelvragen bij een check zonder deelvragen worden geweigerd", () => {
    const i = invoer();
    i.checks.data = { b: "intern" };
    expect(fouten(() => evalueer(i, regelset))).toEqual(['check "data" heeft geen deelvragen']);
  });

  it("V6. de hoogste deelscore telt; deelvragen met dezelfde hoogste score staan allemaal in de motivatie", () => {
    const u = evalueer(invoer({ checks: { impact: { beschikbaarheid: "serieus", integriteit: "beperkt", vertrouwelijkheid: "serieus" } } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.motivatie).toBe("Serieus (Impact – Beschikbaarheid) en Serieus (Impact – Vertrouwelijkheid).");
  });

  it("V7. Beperkt op een deelvraag geeft de voorwaarde van Impact = Beperkt", () => {
    const u = evalueer(invoer({ checks: { impact: { beschikbaarheid: "beperkt" } } }), regelset);
    expect(u.kleur).toBe("geel");
    expect(u.voorwaarden.join(" ")).toMatch(/Impact = Beperkt/);
  });
});

describe("DPIA-signaal", () => {
  it("D1. Vertrouwelijkheid Serieus geeft altijd een DPIA-signaal, ook zonder aangevinkte persoonsgegevens", () => {
    const u = evalueer(invoer({ checks: { data: "intern", impact: { vertrouwelijkheid: "serieus" } } }), regelset);
    expect(u.dpiaSignaal).toBe(true);
    expect(u.toetsers).toEqual(["toetser_compliance"]);
  });

  it("D2. Vertrouwelijkheid Beperkt zonder persoonsgegevens: geen DPIA-signaal", () => {
    expect(evalueer(invoer({ checks: { impact: { vertrouwelijkheid: "beperkt" } } }), regelset).dpiaSignaal).toBe(false);
  });

  it("D3. persoonsgegevens + Beschikbaarheid Serieus (hoogste deelscore) geeft een DPIA-signaal", () => {
    const u = evalueer(
      invoer({ checks: { data: "persoonsgegevens", impact: { beschikbaarheid: "serieus" } }, extraVragen: { bijzondere_persoonsgegevens: false } }),
      regelset,
    );
    expect(u.dpiaSignaal).toBe(true);
  });
});

describe("AI Act-signaal", () => {
  it("A1. Adviseren over mensen geeft een AI Act-signaal; de extra vraag is dan verplicht", () => {
    expect(fouten(() => evalueer(invoer({ checks: { autonomie: "adviseren" } }), regelset))).toEqual([
      'extra vraag "advies_over_mensen" is niet beantwoord',
    ]);
    const ja = evalueer(invoer({ checks: { autonomie: "adviseren" }, extraVragen: { advies_over_mensen: true } }), regelset);
    expect(ja.aiActSignaal).toBe(true);
    const nee = evalueer(invoer({ checks: { autonomie: "adviseren" }, extraVragen: { advies_over_mensen: false } }), regelset);
    expect(nee.aiActSignaal).toBe(false);
  });

  it("A2. rode vlag 3 (AI beslist zelfstandig over mensen) geeft een AI Act-signaal", () => {
    expect(evalueer(invoer({ rodeVlaggen: { ai_beslist_over_mensen: true } }), regelset).aiActSignaal).toBe(true);
  });

  it("A3. AI Act-signaal stuurt een toetsing ook naar de compliance officer", () => {
    const u = evalueer(
      invoer({ checks: { systemen: "koppelen", autonomie: "adviseren" }, extraVragen: { advies_over_mensen: true } }),
      regelset,
    );
    expect(u.kleur).toBe("oranje");
    expect(u.toetsers).toEqual(BEIDE);
  });

  it("A4. AI Act-signaal en DPIA-signaal kunnen tegelijk gelden (AI selecteert sollicitanten)", () => {
    const u = evalueer(
      invoer({ checks: { data: "persoonsgegevens", autonomie: "beslissen" }, extraVragen: { bijzondere_persoonsgegevens: false } }),
      regelset,
    );
    expect([u.dpiaSignaal, u.aiActSignaal]).toEqual([true, true]);
  });
});

describe("AI Act-signaal maakt de uitkomst minstens 'Eerst toetsen'", () => {
  it("A5. alles groen, maar AI adviseert over mensen → oranje, compliance officer, met uitleg", () => {
    const u = evalueer(invoer({ checks: { autonomie: "adviseren" }, extraVragen: { advies_over_mensen: true } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.uitkomst).toBe("Eerst toetsen");
    expect(u.toetsers).toEqual(["toetser_compliance"]);
    expect(u.motivatie).toBe("AI Act-classificatie nodig (de AI adviseert over mensen, handelt of beslist).");
  });

  it("A6. geel met AI Act-signaal → oranje, zonder voorwaarden (die horen bij geel)", () => {
    const u = evalueer(
      invoer({ checks: { gebruikers: "collegas", autonomie: "adviseren" }, extraVragen: { advies_over_mensen: true } }),
      regelset,
    );
    expect(u.kleur).toBe("oranje");
    expect(u.voorwaarden).toEqual([]);
  });

  it("A7. al oranje door een check: het signaal staat niet in 'Waarom deze kleur?'", () => {
    const u = evalueer(invoer({ checks: { autonomie: "handelen" } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.motivatie).toBe("Handelen (Autonomie).");
  });

  it("A8. instelbaar: zonder minimale uitkomst blijft groen groen (wel met signaal)", () => {
    const r = kopieRegelset();
    delete r.ai_act.minimale_uitkomst;
    const u = evalueer(invoer({ checks: { autonomie: "adviseren" }, extraVragen: { advies_over_mensen: true } }, r), r);
    expect(u.kleur).toBe("groen");
    expect(u.aiActSignaal).toBe(true);
  });
});

describe("rood: toetsers en contact", () => {
  it("R1. bij rood kijken altijd beide toetsers mee", () => {
    expect(evalueer(invoer({ rodeVlaggen: { proces_zonder_eigenaar: true } }), regelset).toetsers).toEqual(BEIDE);
  });

  it("R2. rode vlag 5 heeft een alternatief: geen contact nodig", () => {
    const u = evalueer(invoer({ rodeVlaggen: { proces_zonder_eigenaar: true } }), regelset);
    expect(u.alternatieven).toEqual(["Wijs een eigenaar aan en regel het beheer."]);
    expect(u.contactNodig).toBe(false);
  });

  it("R3. rode vlag 3 zonder alternatief: Team Digitale Ontwikkeling neemt contact op", () => {
    const u = evalueer(invoer({ rodeVlaggen: { ai_beslist_over_mensen: true } }), regelset);
    expect(u.alternatieven).toEqual([]);
    expect(u.contactNodig).toBe(true);
  });

  it("R4. is er naast een oorzaak zonder alternatief ook een met alternatief, dan geen contact", () => {
    const u = evalueer(invoer({ rodeVlaggen: { ai_beslist_over_mensen: true, open_zonder_toetsing: true } }), regelset);
    expect(u.alternatieven).toEqual(["Eerst toetsen, dan pas delen."]);
    expect(u.contactNodig).toBe(false);
  });

  it("R5. bij oranje of lager is nooit contact nodig", () => {
    expect(evalueer(invoer({ checks: { impact: { integriteit: "serieus" } } }), regelset).contactNodig).toBe(false);
  });
});

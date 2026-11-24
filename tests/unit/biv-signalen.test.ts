/**
 * Randgevallen bij Impact (BIV), toetsers bij rood en
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

// Het DPIA- en AI Act-signaal zijn in regelset 0.8 vervangen door de privacy-telling en het AI-risico:
// zie tests/unit/verdieping.test.ts.

describe("rood: toetsers en contact", () => {
  it("R1. bij rood kijken altijd beide toetsers mee", () => {
    expect(evalueer(invoer({ rodeVlaggen: { proces_zonder_eigenaar: true } }), regelset).toetsers).toEqual(BEIDE);
  });

  it("R2. rode vlag 5 heeft een alternatief: geen contact nodig", () => {
    const u = evalueer(invoer({ rodeVlaggen: { proces_zonder_eigenaar: true } }), regelset);
    expect(u.alternatieven).toEqual(["Wijs een eigenaar aan en regel het beheer."]);
    expect(u.contactNodig).toBe(false);
  });

  it("R3. rood zonder alternatief (Vertrouwelijkheid Groot): Team Digitale Ontwikkeling neemt contact op", () => {
    const u = evalueer(invoer({ checks: { impact: { vertrouwelijkheid: "groot" } } }), regelset);
    expect(u.alternatieven).toEqual([]);
    expect(u.contactNodig).toBe(true);
  });

  it("R4. is er naast een oorzaak zonder alternatief ook een met alternatief, dan geen contact", () => {
    const u = evalueer(invoer({ checks: { impact: { vertrouwelijkheid: "groot" } }, rodeVlaggen: { open_zonder_toetsing: true } }), regelset);
    expect(u.alternatieven).toEqual(["Eerst toetsen, dan pas delen."]);
    expect(u.contactNodig).toBe(false);
  });

  it("R6. 'AI beslist over mensen' telt alleen bij Autonomie = Beslissen (regelset 0.8, B7)", () => {
    // Niet gesteld, dus "nee", ook als er nog een oud antwoord "ja" in staat.
    expect(evalueer(invoer({ rodeVlaggen: { ai_beslist_over_mensen: true } }), regelset).kleur).toBe("groen");
    const u = evalueer(
      invoer({ checks: { autonomie: "beslissen" }, rodeVlaggen: { ai_beslist_over_mensen: true }, verdieping: { ai_gebruik: "ja" } }),
      regelset,
    );
    expect(u.kleur).toBe("rood");
    expect(u.redenen.some((r) => r.soort === "rode_vlag" && r.vlagId === "ai_beslist_over_mensen")).toBe(true);
  });

  it("R5. bij oranje of lager is nooit contact nodig", () => {
    expect(evalueer(invoer({ checks: { impact: { integriteit: "serieus" } } }), regelset).contactNodig).toBe(false);
  });
});

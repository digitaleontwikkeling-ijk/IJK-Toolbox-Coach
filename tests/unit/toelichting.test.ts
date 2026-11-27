/** Toetsers: "Waarom deze kleur?" in zinnen en een korte titel van de use case. */
import { describe, expect, it } from "vitest";
import { evalueer } from "@/domain/beslisregels";
import { korteTitel, kleurToelichting, type ToelichtingInvoer } from "@/domain/toelichting";
import { invoer, regelset } from "../helpers";

function advies(opties: Parameters<typeof invoer>[0], tool = "claude_code"): ToelichtingInvoer {
  const i = { ...invoer(opties), toolBuitenToolbox: tool === "andere_tool" };
  const u = evalueer(i, regelset);
  return {
    regelversie: regelset.versie, uitkomst: u.kleur, tooladvies: { tool },
    antwoorden: { checks: i.checks, extraVragen: i.extraVragen ?? {}, verdieping: i.verdieping ?? {} }, rodeVlaggen: i.rodeVlaggen,
  };
}

describe("waarom deze kleur, in zinnen", () => {
  it("noemt de uitkomst en per reden een volledige zin", () => {
    const t = kleurToelichting(regelset, advies({ checks: { systemen: "lezen", gebruikers: "collegas" } }))!;
    expect(t.intro).toMatch(/^De uitkomst is ‘Aan de slag met voorwaarden’ \(geel\)\. Dat komt door het volgende:$/);
    expect(t.zinnen).toEqual(["Bij Systemen is gekozen voor ‘Lezen’.", "Bij Gebruikers is gekozen voor ‘Collega's’."]);
    expect(t.zinnen.every((z) => /[.]$/.test(z))).toBe(true);
  });

  it("aanvullende vraag met ja, en een minimum door een signaal", () => {
    const rood = kleurToelichting(regelset, advies({ rodeVlaggen: { open_zonder_toetsing: true } }))!;
    expect(rood.zinnen.some((z) => z.startsWith("Op de aanvullende vraag over"))).toBe(true);
    const buiten = kleurToelichting(regelset, advies({}, "andere_tool"))!;
    expect(buiten.zinnen.some((z) => /minstens ‘Eerst toetsen’/.test(z))).toBe(true);
  });

  it("alles groen; en geen toelichting als de regelset of de kleur niet meer klopt", () => {
    expect(kleurToelichting(regelset, advies({}))!.intro).toContain("alle antwoorden geven groen");
    expect(kleurToelichting(regelset, { ...advies({}), regelversie: "0.1" })).toBeNull();
    expect(kleurToelichting(regelset, { ...advies({}), uitkomst: "rood" })).toBeNull();
  });
});

describe("korte titel van de use case", () => {
  it("de eerste zin, zonder punt; lang wordt ingekort op een woordgrens", () => {
    expect(korteTitel("Verzuimdashboard van mijn afdeling. Met gegevens uit AFAS.")).toBe("Verzuimdashboard van mijn afdeling");
    const t = korteTitel("Een heel lange beschrijving van een use case die maar doorgaat en doorgaat zonder ooit te eindigen met een punt");
    expect(t.length).toBeLessThanOrEqual(71);
    expect(t.endsWith("…")).toBe(true);
  });
});

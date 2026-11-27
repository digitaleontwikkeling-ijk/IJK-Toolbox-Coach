/** Overzicht van alle vragen en antwoorden voor toetsers en beheerders. */
import { describe, expect, it } from "vitest";
import { antwoordenOverzicht, type OverzichtInvoer } from "@/domain/overzicht";
import { evalueer } from "@/domain/beslisregels";
import { content, invoer, regelset } from "../helpers";

function advies(opties: Parameters<typeof invoer>[0], coachVoorstellen: OverzichtInvoer["coachVoorstellen"]): OverzichtInvoer {
  const i = invoer(opties);
  const u = evalueer(i, regelset);
  return {
    verduidelijking: [{ vraag: "Met welke gegevens ga je werken?", antwoord: "Alleen testdata" }],
    tooladvies: { tool: content.tools.tools[0]!.id, bron: "coach" },
    antwoorden: { checks: i.checks, extraVragen: i.extraVragen ?? {}, verdieping: i.verdieping ?? {} },
    rodeVlaggen: i.rodeVlaggen,
    feiten: u.feiten,
    coachVoorstellen,
  };
}
const regel = (groepen: ReturnType<typeof antwoordenOverzicht>, titel: string, vraag: RegExp) =>
  groepen.find((g) => g.titel.includes(titel))!.regels.find((r) => vraag.test(r.vraag))!;

describe("overzicht alle vragen en antwoorden", () => {
  it("toont per check de volledige vraag, het antwoord en of het een bevestigd of aangepast voorstel was", () => {
    const g = antwoordenOverzicht(regelset, content.tools, advies(
      { checks: { data: "intern", systemen: "lezen" } },
      { data: { voorstel: "intern" }, systemen: { voorstel: "geen" } },
    ));
    const data = regel(g, "Data", /Welke data gebruik je/);
    expect(data.antwoord).toBe("Intern");
    expect(data.antwoordKleuren).toEqual([{ label: "Intern", kleur: "groen" }]);
    expect(regel(g, "Impact", /^Integriteit: /).antwoordKleuren?.[0]?.kleur).toBeDefined();
    expect(data.herkomst).toBe("voorstel");
    const systemen = regel(g, "Systemen", /Welke systemen raak je/);
    expect(systemen.herkomst).toBe("aangepast");
    expect(systemen.toelichting).toContain("Geen");
    expect(regel(g, "Gebruikers", /Wie gebruikt/).herkomst).toBe("zelf");
    // Impact per deelvraag, met de volledige vraag.
    expect(regel(g, "Impact", /^Integriteit: /).vraag).toContain("Wat als de uitkomst fout is?");
    // Fase 1: de verduidelijkende vraag en de tool (voorstel van de coach).
    expect(regel(g, "Fase 1", /Met welke gegevens/).antwoord).toBe("Alleen testdata");
    expect(regel(g, "Fase 1", /Welke tool past/).herkomst).toBe("voorstel");
  });

  it("vragen die niet gesteld zijn: afgeleid uit een ander antwoord, of niet van toepassing", () => {
    // Autonomie = Beslissen (over mensen): sommige AI-vragen volgen daaruit; de aanvullende vraag over AI wordt gesteld.
    const g = antwoordenOverzicht(regelset, content.tools, advies(
      { checks: { autonomie: "beslissen" }, verdieping: { ai_gebruik: "ja" } },
      {},
    ));
    const afgeleid = g.flatMap((x) => x.regels).filter((r) => r.herkomst === "afgeleid");
    expect(afgeleid.length).toBeGreaterThan(0);
    expect(afgeleid.every((r) => r.toelichting)).toBe(true);
    // Zonder Beslissen wordt de aanvullende vraag over AI die over mensen beslist niet gesteld.
    const g2 = antwoordenOverzicht(regelset, content.tools, advies({ checks: { autonomie: "assisteren" } }, {}));
    expect(regel(g2, "Aanvullende", /Beslist AI zelfstandig/).herkomst).toBe("niet_gesteld");
  });

  it("oudere adviezen zonder bewaarde voorstellen: geen herkomst bij de checks", () => {
    const g = antwoordenOverzicht(regelset, content.tools, advies({}, null));
    expect(regel(g, "Data", /Welke data/).herkomst).toBeUndefined();
    expect(regel(g, "Aanvullende", /eigen account/).herkomst).toBeUndefined();
  });
});

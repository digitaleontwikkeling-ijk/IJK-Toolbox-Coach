/** Checks met meerdere antwoorden: per check telt het antwoord met de hoogste kleur. */
import { describe, expect, it } from "vitest";
import { evalueer, OngeldigeInvoerFout } from "@/domain/beslisregels";
import { invoer, kopieRegelset, regelset } from "../helpers";

describe("meerdere antwoorden per check", () => {
  it("M1. intern + klanten bij Gebruikers: de hoogste kleur (oranje) telt", () => {
    const u = evalueer(invoer({ checks: { gebruikers: ["collegas", "extern"] } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.motivatie).toBe("Extern/klanten (Gebruikers).");
    expect(u.toetsers).toEqual(["toetser_architect"]);
  });

  it("M2. twee gele antwoorden in één check: beide voorwaarden", () => {
    const r = kopieRegelset();
    // Fictief: maak "afdeling" geel met een voorwaarde, om twee gele antwoorden in één check te testen.
    const afd = r.checks.find((c) => c.id === "gebruikers")!.antwoorden.find((a) => a.id === "afdeling")!;
    afd.kleur = "geel";
    afd.voorwaarde = "Testvoorwaarde afdeling.";
    const u = evalueer(invoer({ checks: { gebruikers: ["collegas", "afdeling"] } }, r), r);
    expect(u.kleur).toBe("geel");
    expect(u.voorwaarden).toEqual(["Gaat je team erop vertrouwen? Wijs een eigenaar aan en documenteer.", "Testvoorwaarde afdeling."]);
    expect(u.motivatie).toBe("Collega's (Gebruikers) en Afdeling (Gebruikers).");
  });

  it("M3. alleen de antwoorden met de hoogste kleur geven de doorslag (geen voorwaarde van een lager antwoord)", () => {
    const u = evalueer(invoer({ checks: { systemen: ["lezen", "schrijven"] } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.voorwaarden).toEqual([]);
    expect(u.motivatie).toBe("Schrijven in bedrijfssystemen (Systemen).");
  });

  it("M4. DPIA-signaal als persoonsgegevens één van de gekozen datasoorten is", () => {
    const u = evalueer(
      invoer({
        checks: { data: ["intern", "persoonsgegevens"], gebruikers: ["collegas", "extern"] },
        extraVragen: { bijzondere_persoonsgegevens: false },
      }),
      regelset,
    );
    expect(u.dpiaSignaal).toBe(true);
    expect(u.toetsers).toEqual(["toetser_compliance", "toetser_architect"]);
  });

  it("M5. de extra vraag is nodig zodra persoonsgegevens is aangevinkt", () => {
    expect(() => evalueer(invoer({ checks: { data: ["intern", "persoonsgegevens"] } }), regelset)).toThrow(OngeldigeInvoerFout);
  });

  it("M6. rood binnen een meerkeuze-check geeft rood, met alternatief", () => {
    const u = evalueer(invoer({ checks: { autonomie: ["adviseren", "beslissen"] }, extraVragen: { advies_over_mensen: true } }), regelset);
    expect(u.kleur).toBe("rood");
    expect(u.alternatieven.join(" ")).toMatch(/recruiter/);
  });

  it("M7. een lege lijst telt als niet beantwoord", () => {
    try {
      evalueer(invoer({ checks: { data: [] as unknown as string } }), regelset);
      throw new Error("verwachtte een fout");
    } catch (e) {
      expect((e as OngeldigeInvoerFout).fouten).toEqual(['check "data" is niet beantwoord']);
    }
  });

  it("M8. meerdere antwoorden bij een check die er maar één toestaat wordt geweigerd", () => {
    expect(() => evalueer(invoer({ checks: { afhankelijkheid: ["experiment", "team"] } }), regelset)).toThrow(
      /heeft maar één antwoord/,
    );
  });

  it("M9. een ongeldig antwoord in de lijst wordt geweigerd", () => {
    expect(() => evalueer(invoer({ checks: { data: ["intern", "geheim"] } }), regelset)).toThrow(/ongeldig antwoord "geheim"/);
  });

  it("M10. dubbele en losse antwoorden werken hetzelfde als een lijst met één antwoord", () => {
    const los = evalueer(invoer({ checks: { gebruikers: "collegas" } }), regelset);
    const lijst = evalueer(invoer({ checks: { gebruikers: ["collegas", "collegas"] } }), regelset);
    expect(lijst).toEqual(los);
  });

  it("M11. de regelset geeft aan welke checks meerdere antwoorden toestaan", () => {
    expect(regelset.checks.filter((c) => c.meerdere).map((c) => c.id)).toEqual(["data", "systemen", "gebruikers", "autonomie"]);
  });
});

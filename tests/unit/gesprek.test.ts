/**
 * Stap 3 als gesprek: dezelfde vragen als de lijst, één voor één, en voorstellen van de coach worden
 * pas meegeteld als de medewerker ze bevestigt.
 */
import { describe, expect, it } from "vitest";
import { legeWizard, type WizardData } from "@/domain/wizard";
import type { ContentDto } from "@/components/client";
import {
  alleVelden,
  bevestigEigenAntwoorden,
  beurten,
  isAfgerond,
  isVoorstel,
  ontbrekendeVelden,
} from "@/components/wizard/velden";
import { content as geladen } from "../helpers";

const content: ContentDto = { ...geladen, gebruiker: { naam: "Test", rollen: ["medewerker"] } };

/** Loopt het gesprek door: kiest per beurt een antwoord (of het eerste) en bevestigt het. */
function loopDoor(start: WizardData, kies: (id: string) => string | undefined = () => undefined): WizardData {
  let d = start;
  for (let i = 0; i < 100; i++) {
    const b = beurten(content, d).find((x) => !isAfgerond(x, d));
    if (!b) return d;
    const antwoord = kies(b.id) ?? (b.gekozen.length ? undefined : b.opties[0]!.id);
    if (antwoord) d = b.zet(d, [antwoord]);
    d = { ...d, bevestigd: [...d.bevestigd, b.id] };
  }
  throw new Error("het gesprek eindigt niet");
}

describe("gesprek", () => {
  it("stelt precies dezelfde vragen als de lijst, ook als antwoorden nieuwe vragen oproepen", () => {
    const keuzes: Record<string, string> = { data: "persoonsgegevens", ai_gebruik: "ja", autonomie: "beslissen" };
    const eind = loopDoor(legeWizard(), (id) => keuzes[id]);
    expect(beurten(content, eind).map((b) => b.id).sort()).toEqual(alleVelden(content, eind).map((v) => v.id).sort());
    expect(ontbrekendeVelden(content, eind)).toEqual([]);
    // Met persoonsgegevens en AI komen er privacy- en AI-vragen bij.
    const ids = beurten(content, eind).map((b) => b.id);
    expect(ids).toContain("ai_gebruik");
    expect(ids.length).toBeGreaterThan(alleVelden(content, loopDoor(legeWizard())).length);
  });

  it("begint met de eerste check en eindigt met de aanvullende vragen", () => {
    const lijst = beurten(content, loopDoor(legeWizard()));
    expect(lijst[0]!.check?.nummer).toBe(1);
    expect(lijst[0]!.kop).toContain("Check 1 van 6");
    expect(lijst.at(-1)!.check).toBeNull();
    expect(lijst.at(-1)!.kop).toMatch(/^Aanvullende vraag \d+$/);
  });

  it("een voorstel van de coach telt pas als het is bevestigd", () => {
    const check = content.regelset.checks[0]!;
    const antwoord = check.antwoorden[1]!.id;
    const d: WizardData = {
      ...legeWizard(),
      checks: { [check.id]: check.meerdere ? [antwoord] : antwoord },
      coachVoorstellen: { [check.id]: { voorstel: antwoord, zekerheid: "middel" } },
    };
    const b = beurten(content, d)[0]!;
    expect(isVoorstel(b)).toBe(true);
    expect(isAfgerond(b, d)).toBe(false);
    expect(isAfgerond(b, { ...d, bevestigd: [b.id] })).toBe(true);
  });

  it("terug van de lijst: eigen antwoorden gelden als bevestigd, een onaangeroerd voorstel niet", () => {
    const [c1, c2] = content.regelset.checks;
    const d: WizardData = {
      ...legeWizard(),
      checks: { [c1!.id]: c1!.antwoorden[0]!.id, [c2!.id]: c2!.antwoorden[0]!.id },
      coachVoorstellen: { [c2!.id]: { voorstel: c2!.antwoorden[0]!.id, zekerheid: "hoog" } },
    };
    expect(bevestigEigenAntwoorden(content, d).bevestigd).toEqual([c1!.id]);
  });

  it("het antwoord in het gesprek komt op dezelfde plek als in de lijst", () => {
    let d = legeWizard();
    for (const b of beurten(content, loopDoor(d))) {
      const voor = d;
      d = b.zet(d, [b.opties.at(-1)!.id]);
      expect(d).not.toEqual(voor);
    }
    const eind = loopDoor(d);
    const impact = content.regelset.checks.find((c) => c.deelvragen.length > 0)!;
    expect(Object.keys(eind.checks[impact.id] as Record<string, string>).sort()).toEqual(impact.deelvragen.map((x) => x.id).sort());
  });
});

describe("chat in het gesprek", () => {
  it("vindt bij elk veld uit het gesprek de vraag in de regelset", async () => {
    const { onderwerpVanVeld } = await import("@/domain/onderwerp");
    const keuzes: Record<string, string> = { data: "persoonsgegevens", ai_gebruik: "ja", autonomie: "beslissen" };
    const eind = loopDoor(legeWizard(), (id) => keuzes[id]);
    for (const b of beurten(content, eind)) {
      const o = onderwerpVanVeld(content.regelset, b.id);
      expect(o, b.id).toBeDefined();
      expect(o!.vraag).toBe(b.vraag);
      expect(o!.opties.map((x) => x.label)).toEqual(b.opties.map((x) => x.label));
    }
    expect(onderwerpVanVeld(content.regelset, "bestaat_niet")).toBeUndefined();
  });

  it("de oefencoach legt de huidige vraag uit, tenzij je naar een tool vraagt", async () => {
    const { onderwerpVanVeld } = await import("@/domain/onderwerp");
    const { MockCoachClient } = await import("@/coach/MockCoachClient");
    const coach = new MockCoachClient(geladen);
    const autonomie = content.regelset.checks.find((c) => c.id === "autonomie")!;
    const onderwerp = onderwerpVanVeld(content.regelset, "autonomie");
    const basis = { stap: 3, beschrijving: "", tool: "claude_code", geschiedenis: [] };
    const uitleg = await coach.chat({ ...basis, vraag: "Wat bedoel je hiermee?", onderwerp });
    expect(uitleg.antwoord).toContain(autonomie.vraag);
    const tool = geladen.tools.tools.find((x) => x.id !== "claude_code")!;
    const overTool = await coach.chat({ ...basis, vraag: `Mag dit ook met ${tool.naam}?`, onderwerp });
    expect(overTool.antwoord).toContain(tool.naam);
  });
});

describe("oefencoach in het gesprek", () => {
  it("noem je een antwoord, dan legt hij alleen dat antwoord uit", async () => {
    const { onderwerpVanVeld } = await import("@/domain/onderwerp");
    const { MockCoachClient } = await import("@/coach/MockCoachClient");
    const lezen = content.regelset.checks.find((c) => c.id === "autonomie")!.antwoorden.find((a) => a.id === "lezen")!;
    const r = await new MockCoachClient(geladen).chat({
      stap: 3, beschrijving: "", geschiedenis: [], vraag: "Wat bedoel je met lezen?",
      onderwerp: onderwerpVanVeld(content.regelset, "autonomie"),
    });
    expect(r.antwoord).toContain(lezen.uitleg!);
    expect(r.antwoord).not.toContain("Schrijven");
  });
});

/**
 * Controle van de content-bestanden en het schema.
 */
import { describe, expect, it } from "vitest";
import { regelsetSchema } from "@/domain/content-schema";
import { systeemPrompt } from "@/coach/prompts";
import { content, kopieRegelset, regelset } from "../helpers";

describe("content-bestanden", () => {
  it("C1. de meegeleverde content is geldig en heeft een versie", () => {
    expect(regelset.versie).toBe("0.8");
    expect(regelset.checks.map((c) => c.id)).toEqual(["data", "systemen", "gebruikers", "autonomie", "impact", "afhankelijkheid"]);
    expect(regelset.rode_vlaggen).toHaveLength(4);
    expect(regelset.checks.find((c) => c.id === "impact")!.deelvragen.map((d) => d.id)).toEqual(["beschikbaarheid", "integriteit", "vertrouwelijkheid"]);
  });

  it("C2. elke tool heeft spelregels met drie lijsten", () => {
    for (const tool of content.tools.tools) {
      const s = content.spelregels[tool.id]!;
      expect(s.zelf_doen.length).toBeGreaterThan(0);
      expect(s.eerst_toetsen.length).toBeGreaterThan(0);
      expect(s.altijd.length).toBeGreaterThan(0);
    }
  });

  it("C3. elke behoefte uit de opdracht verwijst naar bestaande tools", () => {
    expect(content.tools.behoeften).toHaveLength(6);
    const ids = new Set(content.tools.tools.map((t) => t.id));
    for (const b of content.tools.behoeften) for (const t of b.tools) expect(ids.has(t)).toBe(true);
  });

  it("C4. elke uitkomstkleur heeft een hexwaarde en een naam (kleur nooit zonder naam)", () => {
    for (const k of regelset.kleuren) {
      expect(k.hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(k.uitkomst.length).toBeGreaterThan(0);
    }
  });

  it("C5. elk geel antwoord heeft een voorwaarde; rood zonder alternatief kan alleen als er dan contact volgt", () => {
    const rood = regelset.kleuren.find((k) => k.id === "rood")!;
    for (const c of regelset.checks) {
      for (const a of c.antwoorden) {
        if (a.kleur === "geel") expect(a.voorwaarde, `${c.id}.${a.id}`).toBeTruthy();
        if (a.kleur === "rood" && !a.alternatief) expect(rood.contact_als_geen_alternatief, `${c.id}.${a.id}`).toBe(true);
      }
    }
  });

  it("C6. IJK gebruikt geen n8n: geen keuze, niet in de keuzehulp van de wizard, wel als instructie voor de coach", () => {
    expect(content.tools.tools.map((t) => t.id)).not.toContain("n8n");
    for (const b of content.tools.behoeften) expect(b.tools).not.toContain("n8n");
    expect(content.tools.keuzehints.join(" ")).not.toMatch(/n8n/);
    expect(systeemPrompt("tooladvies", content)).toContain("IJK gebruikt geen n8n. Stel het nooit voor.");
  });

  it("C8. elke keuze bij de checks heeft een toelichting (Impact: voorbeelden per deelvraag, alleen voor de coach)", () => {
    for (const c of regelset.checks) {
      for (const a of c.antwoorden) {
        if (c.deelvragen.length > 0) expect(c.deelvragen.every((d) => d.voorbeelden[a.id]), `${c.id}.${a.id}`).toBe(true);
        else expect(a.uitleg, `${c.id}.${a.id}`).toBeTruthy();
      }
    }
  });

  it("C7. spelregels per tool komen letterlijk uit de presentatie (steekproef)", () => {
    expect(content.spelregels.copilot_workflows!.altijd).toContain("Je geeft geen dienstverleningsprocessen vorm met Copilot workflows");
    expect(content.spelregels.azure_openai!.altijd).toContain("Alleen EU Data Zone- of regionale deployments van IJK gebruiken, nooit Global");
  });
});

describe("schema vangt fouten in de content", () => {
  const meldingen = (r: unknown) => {
    const res = regelsetSchema.safeParse(r);
    return res.success ? [] : res.error.issues.map((i) => i.message);
  };

  it("S1. onbekende kleur bij een antwoord", () => {
    const r = kopieRegelset();
    r.checks[0]!.antwoorden[0]!.kleur = "paars";
    expect(meldingen(r)).toContain('check data, antwoord openbaar: onbekende kleur "paars"');
  });

  it("S2. onbekende toetser", () => {
    const r = kopieRegelset();
    r.checks[1]!.toetser = "toetser_marketing";
    expect(meldingen(r)).toContain('check systemen: onbekende toetser "toetser_marketing"');
  });

  it("S3. AI-regel verwijst naar een antwoord dat niet bestaat", () => {
    const r = kopieRegelset();
    r.ai_risico.regels.push({ gegeven: "ai_toezicht", antwoord: "catastrofaal", klasse: "hoog" });
    expect(meldingen(r)).toContain('ai_risico: onbekend antwoord "catastrofaal" bij ai_toezicht');
  });

  it("S4. dubbele antwoord-id binnen een check", () => {
    const r = kopieRegelset();
    r.checks[0]!.antwoorden.push({ ...r.checks[0]!.antwoorden[0]! });
    expect(meldingen(r)).toContain('dubbele antwoord in check data: "openbaar"');
  });

  it("S5. ongeldige hexkleur", () => {
    const r = kopieRegelset();
    r.kleuren[0]!.hex = "groen";
    expect(meldingen(r)).toContain("verwacht een hexkleur zoals #50A78A");
  });
});

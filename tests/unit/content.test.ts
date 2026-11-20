/**
 * Controle van de content-bestanden en het schema.
 */
import { describe, expect, it } from "vitest";
import { regelsetSchema } from "@/domain/content-schema";
import { content, kopieRegelset, regelset } from "../helpers";

describe("content-bestanden", () => {
  it("C1. de meegeleverde content is geldig en heeft een versie", () => {
    expect(regelset.versie).toBe("0.3");
    expect(regelset.checks.map((c) => c.id)).toEqual(["data", "systemen", "gebruikers", "autonomie", "impact", "afhankelijkheid"]);
    expect(regelset.rode_vlaggen).toHaveLength(4);
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

  it("C5. elk geel antwoord heeft een voorwaarde en elk rood antwoord een alternatief", () => {
    for (const c of regelset.checks) {
      for (const a of c.antwoorden) {
        if (a.kleur === "geel") expect(a.voorwaarde, `${c.id}.${a.id}`).toBeTruthy();
        if (a.kleur === "rood") expect(a.alternatief, `${c.id}.${a.id}`).toBeTruthy();
      }
    }
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

  it("S3. DPIA-regel verwijst naar een antwoord dat niet bestaat", () => {
    const r = kopieRegelset();
    r.dpia.minstens_een_van.push({ check: "impact", antwoorden: ["catastrofaal"] });
    expect(meldingen(r)).toContain('dpia: onbekend antwoord "catastrofaal" bij check impact');
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

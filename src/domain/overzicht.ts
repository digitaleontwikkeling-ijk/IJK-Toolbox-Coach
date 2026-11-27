/**
 * Overzicht van alle vragen en antwoorden van een advies, voor toetsers en beheerders.
 *
 * Per vraag: de volledige vraag, het antwoord en de herkomst (zelf gekozen, voorstel van de coach bevestigd of
 * aangepast, of niet gevraagd omdat het uit een ander antwoord volgde). Pure functie: alles komt uit het
 * vastgelegde advies en de regelset. Het gesprek met de coach staat hier bewust niet in.
 */
import { rodeVlagVanToepassing, type CheckAntwoord } from "./beslisregels";
import type { Regelset, ToolsConfig } from "./content-schema";
import { ANDERE_TOOL } from "./content-schema";
import type { Feit } from "./verdieping";

export type Herkomst = "zelf" | "voorstel" | "aangepast" | "afgeleid" | "niet_gesteld";

export interface OverzichtRegel {
  vraag: string;
  antwoord: string;
  /** Bij de checks: per gekozen antwoord de kleur uit de regelset (voor een kleurlabel). */
  antwoordKleuren?: { label: string; kleur: string }[];
  /** Ontbreekt bij adviezen van vóór het opslaan van de voorstellen van de coach. */
  herkomst?: Herkomst;
  /** Bijvoorbeeld wat de coach voorstelde, of waaruit het antwoord is afgeleid. */
  toelichting?: string;
}

export interface OverzichtGroep {
  titel: string;
  regels: OverzichtRegel[];
}

export interface OverzichtInvoer {
  verduidelijking: { vraag: string; antwoord: string }[];
  tooladvies: { tool: string; bron: "coach" | "medewerker"; andereTool?: { naam: string; link?: string } };
  antwoorden: { checks: Record<string, CheckAntwoord>; extraVragen: Record<string, boolean | "onzeker">; verdieping?: Record<string, string> };
  rodeVlaggen: Record<string, boolean | "onzeker">;
  feiten: Feit[] | null;
  /** Sleutel: check-id, check-id.deelvraag-id (Impact) of tool.gegeven-id. Null bij oudere adviezen. */
  coachVoorstellen: Record<string, { voorstel: string }> | null;
}

const JA_NEE: Record<string, string> = { ja: "Ja", nee: "Nee", onzeker: "Weet ik niet zeker", weet_niet: "Weet ik niet zeker" };
const jaNee = (w: boolean | "onzeker" | undefined) => (w === undefined ? "—" : w === "onzeker" ? JA_NEE.onzeker! : w ? "Ja" : "Nee");
const lijst = (w: CheckAntwoord | undefined): string[] =>
  Array.isArray(w) ? w : typeof w === "string" ? [w] : w && typeof w === "object" ? Object.values(w) : [];

export function antwoordenOverzicht(regelset: Regelset, tools: ToolsConfig, a: OverzichtInvoer): OverzichtGroep[] {
  const v = a.coachVoorstellen;
  /** Herkomst van een antwoord met een mogelijk voorstel van de coach (of op basis van de tool). */
  const herkomst = (sleutel: string, gekozen: string[], labelVan: (id: string) => string): Pick<OverzichtRegel, "herkomst" | "toelichting"> => {
    if (v === null) return {};
    const voorstel = v[sleutel]?.voorstel;
    if (!voorstel) return { herkomst: "zelf" };
    if (gekozen.length === 1 && gekozen[0] === voorstel) return { herkomst: "voorstel" };
    return { herkomst: "aangepast", toelichting: `de coach stelde voor: ${labelVan(voorstel)}` };
  };

  const groepen: OverzichtGroep[] = [];

  // ---------- Fase 1 ----------
  const tool = a.tooladvies.tool === ANDERE_TOOL
    ? `${a.tooladvies.andereTool?.naam || "Andere tool"} (nog niet in de IJK Toolbox)`
    : tools.tools.find((t) => t.id === a.tooladvies.tool)?.naam ?? a.tooladvies.tool;
  groepen.push({
    titel: "Fase 1 · Welke tool past?",
    regels: [
      ...a.verduidelijking.map((q) => ({ vraag: q.vraag, antwoord: q.antwoord || "—", herkomst: "zelf" as const })),
      { vraag: "Welke tool past?", antwoord: tool, herkomst: a.tooladvies.bron === "coach" ? "voorstel" : "zelf" },
    ],
  });

  // ---------- De zes checks, met de vragen die erbij horen ----------
  // De feiten van het advies zijn leidend (die telden mee voor de uitkomst): afgeleid = niet gevraagd;
  // geen feit = de vraag was niet van toepassing. Oudere adviezen zonder feiten: de gegeven antwoorden.
  const feiten = a.feiten ? new Map(a.feiten.map((f) => [f.id, f])) : null;
  for (const c of regelset.checks) {
    const labelVan = (id: string) => c.antwoorden.find((x) => x.id === id)?.label ?? id;
    const kleuren = (ids: string[]) =>
      ids.flatMap((id) => {
        const x = c.antwoorden.find((y) => y.id === id);
        return x ? [{ label: x.label, kleur: x.kleur }] : [];
      });
    const ruw = a.antwoorden.checks[c.id];
    const regels: OverzichtRegel[] = [];
    if (c.deelvragen.length > 0) {
      const perDeel = ruw && typeof ruw === "object" && !Array.isArray(ruw) ? ruw : {};
      for (const d of c.deelvragen) {
        const id = perDeel[d.id];
        regels.push({
          vraag: `${d.naam}: ${d.vraag}`,
          antwoord: id ? labelVan(id) : "—",
          antwoordKleuren: id ? kleuren([id]) : [],
          ...herkomst(`${c.id}.${d.id}`, id ? [id] : [], labelVan),
        });
      }
    } else {
      const ids = lijst(ruw);
      regels.push({ vraag: c.vraag, antwoord: ids.length ? ids.map(labelVan).join(", ") : "—", antwoordKleuren: kleuren(ids), ...herkomst(c.id, ids, labelVan) });
    }

    for (const e of regelset.extra_vragen.filter((x) => x.check === c.id && x.id in a.antwoorden.extraVragen)) {
      regels.push({ vraag: e.vraag, antwoord: jaNee(a.antwoorden.extraVragen[e.id]), ...(v === null ? {} : { herkomst: "zelf" as const }) });
    }

    for (const g of regelset.gegevens.filter((x) => x.plek === c.id)) {
      const gLabel = (id: string) => g.antwoorden.find((x) => x.id === id)?.label ?? JA_NEE[id] ?? id;
      const f = feiten?.get(g.id);
      if (f?.herkomst === "afgeleid") {
        regels.push({ vraag: g.vraag, antwoord: gLabel(f.waarde), herkomst: "afgeleid", toelichting: f.toelichting });
        continue;
      }
      const gegeven = feiten ? (f ? a.antwoorden.verdieping?.[g.id] ?? f.waarde : undefined) : a.antwoorden.verdieping?.[g.id];
      if (gegeven !== undefined) {
        regels.push({ vraag: g.vraag, antwoord: gLabel(gegeven), ...herkomst(`tool.${g.id}`, [gegeven], gLabel) });
      }
    }
    groepen.push({ titel: `Check ${c.nummer} · ${c.naam}`, regels });
  }

  // ---------- Aanvullende vragen ----------
  const invoer = { checks: a.antwoorden.checks, rodeVlaggen: a.rodeVlaggen };
  groepen.push({
    titel: "Aanvullende vragen",
    regels: regelset.rode_vlaggen.map((r) =>
      rodeVlagVanToepassing(r.id, invoer, regelset)
        ? { vraag: r.vraag, antwoord: jaNee(a.rodeVlaggen[r.id]), ...(v === null ? {} : { herkomst: "zelf" as const }) }
        : { vraag: r.vraag, antwoord: "—", herkomst: "niet_gesteld" as const, toelichting: "niet van toepassing bij deze antwoorden" },
    ),
  });
  return groepen;
}

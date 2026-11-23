import path from "node:path";
import { laadContent } from "@/content/laad-content";
import type { BeslisInvoer, CheckAntwoord } from "@/domain/beslisregels";
import type { Regelset } from "@/domain/content-schema";

export const content = laadContent(path.resolve(__dirname, "../content"));
export const regelset: Regelset = content.regelset;

/** Diepe kopie, zodat een test de regelset kan aanpassen zonder andere tests te raken. */
export function kopieRegelset(): Regelset {
  return structuredClone(regelset);
}

/**
 * Maakt een complete invoer. Checks die niet zijn opgegeven krijgen het eerste
 * (laagste) antwoord uit de schaal; rode vlaggen staan standaard op "nee".
 *
 * Impact heeft deelvragen (B, I, V). Geef een object per deelvraag, of één waarde:
 * dan is dat de hoogste deelscore en staat die op Integriteit; de andere deelvragen
 * krijgen het laagste niveau (zie opdracht §7: "kies de andere gelijk of lager").
 */
export function invoer(opties: {
  checks?: Record<string, CheckAntwoord>;
  extraVragen?: Record<string, boolean>;
  rodeVlaggen?: Record<string, boolean>;
} = {}, r: Regelset = regelset): BeslisInvoer {
  const checks: Record<string, CheckAntwoord> = {};
  for (const c of r.checks) {
    const gegeven = opties.checks?.[c.id];
    const laagste = c.antwoorden[0]!.id;
    if (c.deelvragen.length > 0) {
      const perDeel: Record<string, string> = {};
      for (const d of c.deelvragen) perDeel[d.id] = laagste;
      if (typeof gegeven === "string") perDeel.integriteit = gegeven;
      else if (gegeven && !Array.isArray(gegeven)) Object.assign(perDeel, gegeven);
      checks[c.id] = gegeven === undefined || typeof gegeven === "string" || !Array.isArray(gegeven) ? perDeel : gegeven;
    } else {
      checks[c.id] = gegeven ?? laagste;
    }
  }
  const rodeVlaggen: Record<string, boolean> = {};
  for (const v of r.rode_vlaggen) rodeVlaggen[v.id] = opties.rodeVlaggen?.[v.id] ?? false;
  return { checks, extraVragen: opties.extraVragen ?? {}, rodeVlaggen };
}

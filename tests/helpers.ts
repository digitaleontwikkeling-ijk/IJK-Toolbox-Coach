import path from "node:path";
import { laadContent } from "@/content/laad-content";
import type { BeslisInvoer } from "@/domain/beslisregels";
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
 * Dit volgt de afspraak voor scenario's waarin niet alle checks zijn genoemd.
 */
export function invoer(opties: {
  checks?: Record<string, string>;
  extraVragen?: Record<string, boolean>;
  rodeVlaggen?: Record<string, boolean>;
} = {}, r: Regelset = regelset): BeslisInvoer {
  const checks: Record<string, string> = {};
  for (const c of r.checks) checks[c.id] = opties.checks?.[c.id] ?? c.antwoorden[0]!.id;
  const rodeVlaggen: Record<string, boolean> = {};
  for (const v of r.rode_vlaggen) rodeVlaggen[v.id] = opties.rodeVlaggen?.[v.id] ?? false;
  return { checks, extraVragen: opties.extraVragen ?? {}, rodeVlaggen };
}

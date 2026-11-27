/**
 * "Waarom deze kleur?" in zinnen, voor toetsers en beheerders.
 *
 * De redenen komen uit de beslisregels zelf (`evalueer`), opnieuw berekend uit de vastgelegde antwoorden. Dat kan
 * alleen betrouwbaar als het advies met dezelfde regelset is gegeven en dezelfde kleur oplevert; anders geeft deze
 * functie null en toont de kaart de vastgelegde korte motivatie. Pure functie, geen nieuwe regels.
 */
import { evalueer, type CheckAntwoord } from "./beslisregels";
import type { Regelset } from "./content-schema";
import { ANDERE_TOOL } from "./content-schema";

export interface KleurToelichting {
  intro: string;
  zinnen: string[];
}

export interface ToelichtingInvoer {
  regelversie: string;
  uitkomst: string;
  tooladvies: { tool: string };
  antwoorden: { checks: Record<string, CheckAntwoord>; extraVragen: Record<string, boolean | "onzeker">; verdieping?: Record<string, string> };
  rodeVlaggen: Record<string, boolean | "onzeker">;
}

const hoofdletter = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function kleurToelichting(regelset: Regelset, a: ToelichtingInvoer): KleurToelichting | null {
  if (a.regelversie !== regelset.versie) return null;
  let u;
  try {
    u = evalueer(
      {
        checks: a.antwoorden.checks,
        extraVragen: a.antwoorden.extraVragen,
        rodeVlaggen: a.rodeVlaggen,
        verdieping: a.antwoorden.verdieping ?? {},
        toolBuitenToolbox: a.tooladvies.tool === ANDERE_TOOL,
      },
      regelset,
    );
  } catch {
    return null;
  }
  if (u.kleur !== a.uitkomst) return null;

  const uitkomstVan = (kleurId: string | undefined) => regelset.kleuren.find((k) => k.id === kleurId)?.uitkomst ?? kleurId ?? "";
  const minimum = (signaal: string): string | undefined => {
    if (signaal === "tool_buiten_toolbox") return regelset.tool_buiten_toolbox.minimale_uitkomst;
    if (signaal === "rode_vlag_onzeker") return regelset.rode_vlag_onzeker.minimale_uitkomst;
    if (signaal === "dpia") return regelset.dpia.klassen.find((k) => k.id === u.dpia.klasse)?.minimale_uitkomst;
    if (signaal === "ai_risico") return regelset.ai_risico.klassen.find((k) => k.id === u.aiRisico.klasse)?.minimale_uitkomst;
    return undefined;
  };

  const zinnen = u.redenen.map((r) => {
    if (r.soort === "check") {
      const waar = r.deelvraagNaam ? `${r.checkNaam} (${r.deelvraagNaam})` : r.checkNaam;
      return `Bij ${waar} is gekozen voor ‘${r.antwoordLabel}’.`;
    }
    if (r.soort === "rode_vlag") return `Op de aanvullende vraag over ${r.kort} is ‘ja’ geantwoord.`;
    const min = minimum(r.signaal);
    const tekst = r.signaal === "dpia" ? `Privacy: ${r.tekst}` : hoofdletter(r.tekst);
    return min ? `${tekst}. Daarom is de uitkomst minstens ‘${uitkomstVan(min)}’.` : `${tekst}.`;
  });

  const kleur = regelset.kleuren.find((k) => k.id === u.kleur)!;
  // Laagste kleur: geen opsomming van alle (groene) antwoorden.
  if (regelset.kleuren[0]?.id === kleur.id) return { intro: `De uitkomst is ‘${kleur.uitkomst}’ (${kleur.id}): alle antwoorden geven groen.`, zinnen: [] };
  const intro = zinnen.length
    ? `De uitkomst is ‘${kleur.uitkomst}’ (${kleur.id}). Dat komt door het volgende:`
    : `De uitkomst is ‘${kleur.uitkomst}’ (${kleur.id}): alle antwoorden geven groen.`;
  return { intro, zinnen };
}

/** Korte titel van de use case: de eerste zin, ingekort tot ongeveer 70 tekens. */
export function korteTitel(beschrijving: string): string {
  const zin = beschrijving.trim().split(/(?<=[.!?])\s|\n/)[0]!.replace(/[.!?]+$/, "");
  return zin.length > 70 ? `${zin.slice(0, 70).replace(/\s+\S*$/, "")}…` : zin;
}

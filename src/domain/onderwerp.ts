/**
 * De vraag waar de medewerker het over heeft als hij in het gesprek (stap 3) iets aan de coach vraagt.
 *
 * De browser stuurt alleen het veld-id mee; de tekst van de vraag komt hier uit de regelset (nooit uit de browser).
 * Zo weet de coach waarover hij uitleg geeft, zonder dat er extra gegevens van de medewerker meegaan.
 */
import type { Regelset } from "./content-schema";

export interface Onderwerp {
  /** Bijvoorbeeld "Check 4 · Autonomie" of "Aanvullende vraag". */
  naam: string;
  vraag: string;
  /** Uitleg en hulpteksten bij de vraag. */
  uitleg: string[];
  /** De antwoordopties, met hun uitleg als die er is. */
  opties: { label: string; uitleg?: string }[];
}

const JA_NEE = [{ label: "Ja" }, { label: "Nee" }];
const MET_ONZEKER = [...JA_NEE, { label: "Weet ik niet zeker" }];
const hulpTekst = (h: { kop?: string; tekst: string }) => (h.kop ? `${h.kop}: ${h.tekst}` : h.tekst);

/** Zoekt de vraag bij een veld-id uit stap 3 (zoals in `alleVelden`). Onbekend id: undefined. */
export function onderwerpVanVeld(r: Regelset, veld: string): Onderwerp | undefined {
  for (const c of r.checks) {
    const naam = `Check ${c.nummer} · ${c.naam}`;
    const opties = c.antwoorden.map((a) => ({ label: a.label, uitleg: a.uitleg }));
    if (veld === c.id && c.deelvragen.length === 0) {
      return { naam, vraag: c.vraag, uitleg: c.hulp.map(hulpTekst), opties };
    }
    const deel = c.deelvragen.find((d) => veld === `${c.id}-${d.id}`);
    if (deel) return { naam: `${naam} – ${deel.naam}`, vraag: deel.vraag, uitleg: [c.vraag, ...c.hulp.map(hulpTekst)], opties };
  }
  const extra = r.extra_vragen.find((e) => e.id === veld);
  if (extra) {
    const c = r.checks.find((x) => x.id === extra.check);
    return {
      naam: c ? `Check ${c.nummer} · ${c.naam}` : "Extra vraag",
      vraag: extra.vraag,
      uitleg: extra.uitleg ? [extra.uitleg] : [],
      opties: extra.onzeker_mogelijk ? MET_ONZEKER : JA_NEE,
    };
  }
  const g = r.gegevens.find((x) => x.id === veld);
  if (g) {
    const c = r.checks.find((x) => x.id === g.plek);
    return {
      naam: c ? `Check ${c.nummer} · ${c.naam}` : g.naam,
      vraag: g.vraag,
      uitleg: [g.uitleg],
      opties: g.antwoorden.map((a) => ({ label: a.label })),
    };
  }
  const v = r.rode_vlaggen.find((x) => x.id === veld);
  if (v) return { naam: "Aanvullende vraag", vraag: v.vraag, uitleg: v.uitleg ? [v.uitleg] : [], opties: MET_ONZEKER };
  return undefined;
}

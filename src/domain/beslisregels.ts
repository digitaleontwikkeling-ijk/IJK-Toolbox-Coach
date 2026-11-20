/**
 * Beslisregels van de IJK Toolbox Coach.
 *
 * `evalueer` is een PURE functie: geen database, geen netwerk, geen datum, geen
 * taalmodel. Dezelfde invoer + dezelfde regelset geeft altijd dezelfde uitkomst.
 * Alle inhoud (kleuren, toetsers, DPIA-regels, teksten) komt uit de regelset.
 *
 * Regel: uitkomst = hoogste kleur over alle checks en rode vlaggen.
 * Bij een check met meerdere antwoorden telt het antwoord met de hoogste kleur.
 */
import type { Antwoord, Check, Kleur, Regelset, Vervolgactie } from "./content-schema";

/** De antwoorden van de medewerker. Alles wordt aangeduid met id's uit de regelset. */
export interface BeslisInvoer {
  /**
   * check-id → antwoord-id, of een lijst antwoord-id's bij een check met `meerdere: true`.
   * Bijvoorbeeld { data: "intern", gebruikers: ["collegas", "extern"] }
   */
  checks: Record<string, string | string[]>;
  /** extra-vraag-id → ja/nee. Alleen nodig als de extra vraag van toepassing is. */
  extraVragen?: Record<string, boolean>;
  /** rode-vlag-id → ja/nee. Elke rode vlag moet beantwoord zijn. */
  rodeVlaggen: Record<string, boolean>;
}

export type Reden =
  | { soort: "check"; checkId: string; checkNaam: string; antwoordId: string; antwoordLabel: string }
  | { soort: "rode_vlag"; vlagId: string; kort: string };

export interface BeslisUitkomst {
  regelversie: string;
  kleur: string;
  uitkomst: string;
  vervolgactie: Vervolgactie;
  /** De checks en rode vlaggen die de hoogste kleur veroorzaakten. */
  redenen: Reden[];
  /** "Waarom deze kleur?" — opgebouwd uit `redenen` en de teksten in de regelset. */
  motivatie: string;
  /** Alleen gevuld als de vervolgactie een toetsing is. */
  toetsers: string[];
  dpiaSignaal: boolean;
  /** Alleen gevuld als de vervolgactie een accountaanvraag met voorwaarden is. */
  voorwaarden: string[];
  /** Alleen gevuld als de uitkomst "alleen vastleggen" is (geen aanvraag). */
  alternatieven: string[];
}

export class OngeldigeInvoerFout extends Error {
  constructor(public readonly fouten: string[]) {
    super(`Ongeldige invoer voor de beslisregels: ${fouten.join("; ")}`);
    this.name = "OngeldigeInvoerFout";
  }
}

/** Controleert of de invoer compleet en geldig is. Geeft een lijst met fouten (leeg = in orde). */
export function valideerInvoer(invoer: BeslisInvoer, regelset: Regelset): string[] {
  const fouten: string[] = [];
  const checkIds = new Set(regelset.checks.map((c) => c.id));

  for (const id of Object.keys(invoer.checks ?? {})) {
    if (!checkIds.has(id)) fouten.push(`onbekende check "${id}"`);
  }
  for (const check of regelset.checks) {
    const ruw = invoer.checks?.[check.id];
    const gekozen = gekozenIds(invoer, check.id);
    if (gekozen.length === 0) {
      fouten.push(`check "${check.id}" is niet beantwoord`);
      continue;
    }
    if (Array.isArray(ruw) && ruw.length > 1 && !check.meerdere) {
      fouten.push(`check "${check.id}" heeft maar één antwoord`);
    }
    for (const id of gekozen) {
      if (!check.antwoorden.some((a) => a.id === id)) fouten.push(`ongeldig antwoord "${id}" bij check "${check.id}"`);
    }
  }

  for (const extra of regelset.extra_vragen) {
    if (!extraVraagVanToepassing(extra.id, invoer, regelset)) continue;
    if (typeof invoer.extraVragen?.[extra.id] !== "boolean") {
      fouten.push(`extra vraag "${extra.id}" is niet beantwoord`);
    }
  }

  const vlagIds = new Set(regelset.rode_vlaggen.map((v) => v.id));
  for (const id of Object.keys(invoer.rodeVlaggen ?? {})) {
    if (!vlagIds.has(id)) fouten.push(`onbekende rode vlag "${id}"`);
  }
  for (const vlag of regelset.rode_vlaggen) {
    if (typeof invoer.rodeVlaggen?.[vlag.id] !== "boolean") {
      fouten.push(`rode vlag "${vlag.id}" is niet beantwoord`);
    }
  }
  return fouten;
}

/** Is de extra vraag van toepassing bij de gekozen antwoorden? */
export function extraVraagVanToepassing(extraId: string, invoer: BeslisInvoer, regelset: Regelset): boolean {
  const extra = regelset.extra_vragen.find((e) => e.id === extraId);
  if (!extra) return false;
  return gekozenIds(invoer, extra.check).some((id) => extra.toon_bij.includes(id));
}

/** De gekozen antwoord-id's bij een check, altijd als lijst (leeg = niet beantwoord). */
export function gekozenIds(invoer: BeslisInvoer, checkId: string): string[] {
  const ruw = invoer.checks?.[checkId];
  const lijst = Array.isArray(ruw) ? ruw : ruw === undefined || ruw === null ? [] : [ruw];
  return uniek(lijst.filter((x): x is string => typeof x === "string" && x !== ""));
}

export function evalueer(invoer: BeslisInvoer, regelset: Regelset): BeslisUitkomst {
  const fouten = valideerInvoer(invoer, regelset);
  if (fouten.length > 0) throw new OngeldigeInvoerFout(fouten);

  const rang = new Map(regelset.kleuren.map((k, i) => [k.id, i]));
  const rangVan = (kleurId: string) => rang.get(kleurId)!;

  // 1. Kleur per check (hoogste kleur van de gekozen antwoorden) en per rode vlag (alleen "ja").
  const checkScores = regelset.checks.map((check) => {
    const antwoorden = gekozenAntwoorden(check, invoer);
    const kleur = antwoorden.reduce((max, a) => (rangVan(a.kleur) > rangVan(max) ? a.kleur : max), antwoorden[0]!.kleur);
    // Alleen de antwoorden met de hoogste kleur bepalen de score van deze check.
    return { check, kleur, bepalend: antwoorden.filter((a) => a.kleur === kleur) };
  });
  const vlaggenJa = regelset.rode_vlaggen.filter((v) => invoer.rodeVlaggen[v.id] === true);

  // 2. Hoogste kleur.
  let hoogste = 0;
  for (const s of checkScores) hoogste = Math.max(hoogste, rangVan(s.kleur));
  if (vlaggenJa.length > 0) hoogste = Math.max(hoogste, rangVan(regelset.rode_vlag_kleur));
  const kleur: Kleur = regelset.kleuren[hoogste]!;

  // 3. Wat gaf de doorslag? Alle checks en vlaggen met de hoogste kleur.
  const doorslagChecks = checkScores.filter((s) => s.kleur === kleur.id);
  const doorslagVlaggen = regelset.rode_vlag_kleur === kleur.id ? vlaggenJa : [];
  const redenen: Reden[] = [
    ...doorslagVlaggen.map((v): Reden => ({ soort: "rode_vlag", vlagId: v.id, kort: v.kort })),
    ...doorslagChecks.flatMap((s) =>
      s.bepalend.map((a): Reden => ({
        soort: "check",
        checkId: s.check.id,
        checkNaam: s.check.naam,
        antwoordId: a.id,
        antwoordLabel: a.label,
      })),
    ),
  ];

  // 4. DPIA-signaal.
  const dpiaSignaal =
    regelset.dpia.vereist.every((c) => conditieGeldt(c, invoer, regelset)) &&
    regelset.dpia.minstens_een_van.some((c) => conditieGeldt(c, invoer, regelset));

  // 5. Toetsers (alleen als de vervolgactie een toetsing is).
  let toetsers: string[] = [];
  if (kleur.vervolgactie === "toetsing") {
    const nodig = new Set(doorslagChecks.map((s) => s.check.toetser));
    if (dpiaSignaal) nodig.add(regelset.dpia.toetser);
    toetsers = regelset.toetsers.map((t) => t.id).filter((t) => nodig.has(t));
  }

  // 6. Voorwaarden (alleen bij een accountaanvraag met voorwaarden).
  const voorwaarden =
    kleur.vervolgactie === "accountaanvraag_met_voorwaarden"
      ? uniek(doorslagChecks.flatMap((s) => s.bepalend.map((a) => a.voorwaarde)).filter(isTekst))
      : [];

  // 7. Alternatieven (alleen als er geen aanvraag mogelijk is).
  const alternatieven =
    kleur.vervolgactie === "alleen_vastleggen"
      ? uniek([
          ...doorslagVlaggen.map((v) => v.alternatief),
          ...doorslagChecks.flatMap((s) => s.bepalend.map((a) => a.alternatief)),
        ].filter(isTekst))
      : [];

  return {
    regelversie: regelset.versie,
    kleur: kleur.id,
    uitkomst: kleur.uitkomst,
    vervolgactie: kleur.vervolgactie,
    redenen,
    motivatie: maakMotivatie(kleur, redenen, regelset),
    toetsers,
    dpiaSignaal,
    voorwaarden,
    alternatieven,
  };
}

/** Bouwt de zin voor "Waarom deze kleur?", bijvoorbeeld "Persoonsgegevens (Data) en Koppelen (Systemen)." */
export function maakMotivatie(kleur: Kleur, redenen: Reden[], regelset: Regelset): string {
  const delen = redenen.map((r) =>
    r.soort === "check"
      ? `${r.antwoordLabel} (${r.checkNaam})`
      : regelset.motivatie_rode_vlag.replace("{kort}", r.kort),
  );
  const tekst = kleur.motivatie.replace("{redenen}", opsomming(delen));
  return hoofdletter(tekst);
}

function gekozenAntwoorden(check: Check, invoer: BeslisInvoer): Antwoord[] {
  // Na valideerInvoer bestaat elk gekozen antwoord en is er minstens één.
  const ids = gekozenIds(invoer, check.id);
  return check.antwoorden.filter((a) => ids.includes(a.id));
}

type Conditie = Regelset["dpia"]["vereist"][number];
function conditieGeldt(c: Conditie, invoer: BeslisInvoer, regelset: Regelset): boolean {
  if ("extra_vraag" in c) {
    // Een antwoord op een extra vraag telt alleen als die vraag van toepassing is.
    return extraVraagVanToepassing(c.extra_vraag, invoer, regelset) && invoer.extraVragen?.[c.extra_vraag] === true;
  }
  return gekozenIds(invoer, c.check).some((id) => c.antwoorden.includes(id));
}

/** "a", "a en b", "a, b en c" */
function opsomming(delen: string[]): string {
  if (delen.length <= 1) return delen.join("");
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}

function hoofdletter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function uniek(lijst: string[]): string[] {
  return [...new Set(lijst)];
}

function isTekst(x: string | undefined): x is string {
  return typeof x === "string" && x.length > 0;
}

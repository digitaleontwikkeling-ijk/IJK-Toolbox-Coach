/**
 * Beslisregels van de IJK Toolbox Coach.
 *
 * `evalueer` is een PURE functie: geen database, geen netwerk, geen datum, geen
 * taalmodel. Dezelfde invoer + dezelfde regelset geeft altijd dezelfde uitkomst.
 * Alle inhoud (kleuren, toetsers, signalen, teksten) komt uit de regelset.
 *
 * Regel: uitkomst = hoogste kleur over alle checks en rode vlaggen.
 * - Bij een check met meerdere antwoorden telt het antwoord met de hoogste kleur.
 * - Bij een check met deelvragen (Impact: B, I, V) telt de hoogste deelscore.
 * - Bij een AI Act-signaal is de uitkomst minstens de ingestelde kleur (oranje).
 */
import type { Antwoord, Check, Conditie, Deelvraag, Kleur, Regelset, Vervolgactie } from "./content-schema";

/** Antwoord op een check: één antwoord-id, een lijst (meerdere antwoorden) of per deelvraag een antwoord-id. */
export type CheckAntwoord = string | string[] | Record<string, string>;

/** De antwoorden van de medewerker. Alles wordt aangeduid met id's uit de regelset. */
export interface BeslisInvoer {
  /**
   * check-id → antwoord. Bijvoorbeeld:
   * { data: "intern", gebruikers: ["collegas", "extern"],
   *   impact: { beschikbaarheid: "beperkt", integriteit: "nauwelijks", vertrouwelijkheid: "nauwelijks" } }
   */
  checks: Record<string, CheckAntwoord>;
  /** extra-vraag-id → ja/nee. Alleen nodig als de extra vraag van toepassing is. */
  extraVragen?: Record<string, boolean>;
  /** rode-vlag-id → ja/nee. Elke rode vlag moet beantwoord zijn. */
  rodeVlaggen: Record<string, boolean>;
}

export type Reden =
  | {
      soort: "check";
      checkId: string;
      checkNaam: string;
      deelvraagId?: string;
      deelvraagNaam?: string;
      antwoordId: string;
      antwoordLabel: string;
    }
  | { soort: "rode_vlag"; vlagId: string; kort: string }
  /** Een signaal (AI Act) dat de uitkomst naar een minimale kleur verhoogde. */
  | { soort: "signaal"; signaal: "ai_act"; tekst: string };

export interface BeslisUitkomst {
  regelversie: string;
  kleur: string;
  uitkomst: string;
  vervolgactie: Vervolgactie;
  /** De checks (en deelvragen) en rode vlaggen die de hoogste kleur veroorzaakten. */
  redenen: Reden[];
  /** "Waarom deze kleur?" — opgebouwd uit `redenen` en de teksten in de regelset. */
  motivatie: string;
  /** Toetsers bij deze uitkomst (zie `toetsers` bij de kleur in de regelset). */
  toetsers: string[];
  dpiaSignaal: boolean;
  aiActSignaal: boolean;
  /** Alleen gevuld als de vervolgactie een accountaanvraag met voorwaarden is. */
  voorwaarden: string[];
  /** Alleen gevuld als de uitkomst "alleen vastleggen" is (geen aanvraag). */
  alternatieven: string[];
  /** Geen alternatief bij een uitkomst waarbij dan contact volgt: Team Digitale Ontwikkeling neemt contact op. */
  contactNodig: boolean;
}

export class OngeldigeInvoerFout extends Error {
  constructor(public readonly fouten: string[]) {
    super(`Ongeldige invoer voor de beslisregels: ${fouten.join("; ")}`);
    this.name = "OngeldigeInvoerFout";
  }
}

// ---------- Hulpfuncties om antwoorden te lezen ----------

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** De gekozen antwoord-id's bij een check, altijd als lijst (bij deelvragen: de antwoorden van alle deelvragen). */
export function gekozenIds(invoer: BeslisInvoer, checkId: string): string[] {
  const ruw = invoer.checks?.[checkId];
  const lijst = isObject(ruw) ? Object.values(ruw) : Array.isArray(ruw) ? ruw : ruw === undefined || ruw === null ? [] : [ruw];
  return uniek(lijst.filter((x): x is string => typeof x === "string" && x !== ""));
}

/** Het gekozen antwoord bij één deelvraag. */
export function deelvraagAntwoord(invoer: BeslisInvoer, checkId: string, deelvraagId: string): string | undefined {
  const ruw = invoer.checks?.[checkId];
  const w = isObject(ruw) ? ruw[deelvraagId] : undefined;
  return typeof w === "string" && w !== "" ? w : undefined;
}

/** Is de extra vraag van toepassing bij de gekozen antwoorden? */
export function extraVraagVanToepassing(extraId: string, invoer: BeslisInvoer, regelset: Regelset): boolean {
  const extra = regelset.extra_vragen.find((e) => e.id === extraId);
  if (!extra) return false;
  return gekozenIds(invoer, extra.check).some((id) => extra.toon_bij.includes(id));
}

// ---------- Invoercontrole ----------

/** Controleert of de invoer compleet en geldig is. Geeft een lijst met fouten (leeg = in orde). */
export function valideerInvoer(invoer: BeslisInvoer, regelset: Regelset): string[] {
  const fouten: string[] = [];
  const checkIds = new Set(regelset.checks.map((c) => c.id));

  for (const id of Object.keys(invoer.checks ?? {})) {
    if (!checkIds.has(id)) fouten.push(`onbekende check "${id}"`);
  }
  for (const check of regelset.checks) {
    const ruw = invoer.checks?.[check.id];
    const geldig = (id: string) => check.antwoorden.some((a) => a.id === id);

    if (check.deelvragen.length > 0) {
      if (ruw !== undefined && ruw !== null && !isObject(ruw)) {
        fouten.push(`check "${check.id}" verwacht een antwoord per deelvraag`);
        continue;
      }
      for (const sleutel of Object.keys(isObject(ruw) ? ruw : {})) {
        if (!check.deelvragen.some((d) => d.id === sleutel)) fouten.push(`onbekende deelvraag "${check.id}.${sleutel}"`);
      }
      for (const d of check.deelvragen) {
        const a = deelvraagAntwoord(invoer, check.id, d.id);
        if (a === undefined) fouten.push(`deelvraag "${check.id}.${d.id}" is niet beantwoord`);
        else if (!geldig(a)) fouten.push(`ongeldig antwoord "${a}" bij deelvraag "${check.id}.${d.id}"`);
      }
      continue;
    }

    if (isObject(ruw)) {
      fouten.push(`check "${check.id}" heeft geen deelvragen`);
      continue;
    }
    const gekozen = gekozenIds(invoer, check.id);
    if (gekozen.length === 0) {
      fouten.push(`check "${check.id}" is niet beantwoord`);
      continue;
    }
    if (Array.isArray(ruw) && ruw.length > 1 && !check.meerdere) fouten.push(`check "${check.id}" heeft maar één antwoord`);
    for (const id of gekozen) if (!geldig(id)) fouten.push(`ongeldig antwoord "${id}" bij check "${check.id}"`);
  }

  for (const extra of regelset.extra_vragen) {
    if (!extraVraagVanToepassing(extra.id, invoer, regelset)) continue;
    if (typeof invoer.extraVragen?.[extra.id] !== "boolean") fouten.push(`extra vraag "${extra.id}" is niet beantwoord`);
  }

  const vlagIds = new Set(regelset.rode_vlaggen.map((v) => v.id));
  for (const id of Object.keys(invoer.rodeVlaggen ?? {})) {
    if (!vlagIds.has(id)) fouten.push(`onbekende rode vlag "${id}"`);
  }
  for (const vlag of regelset.rode_vlaggen) {
    if (typeof invoer.rodeVlaggen?.[vlag.id] !== "boolean") fouten.push(`rode vlag "${vlag.id}" is niet beantwoord`);
  }
  return fouten;
}

// ---------- De beslisfunctie ----------

/** Eén gekozen antwoord, eventueel bij een deelvraag. */
interface Keuze {
  antwoord: Antwoord;
  deelvraag?: Deelvraag;
}

export function evalueer(invoer: BeslisInvoer, regelset: Regelset): BeslisUitkomst {
  const fouten = valideerInvoer(invoer, regelset);
  if (fouten.length > 0) throw new OngeldigeInvoerFout(fouten);

  const rang = new Map(regelset.kleuren.map((k, i) => [k.id, i]));
  const rangVan = (kleurId: string) => rang.get(kleurId)!;

  // 1. Kleur per check: de hoogste kleur van de gekozen antwoorden (of deelvragen).
  const checkScores = regelset.checks.map((check) => {
    const keuzes = gekozenKeuzes(check, invoer);
    const kleur = keuzes.reduce(
      (max, k) => (rangVan(k.antwoord.kleur) > rangVan(max) ? k.antwoord.kleur : max),
      keuzes[0]!.antwoord.kleur,
    );
    // Alleen de keuzes met de hoogste kleur bepalen de score van deze check.
    return { check, kleur, bepalend: keuzes.filter((k) => k.antwoord.kleur === kleur) };
  });
  const vlaggenJa = regelset.rode_vlaggen.filter((v) => invoer.rodeVlaggen[v.id] === true);

  // 2. Signalen.
  const geldt = (c: Conditie) => conditieGeldt(c, invoer, regelset);
  const dpiaSignaal =
    (regelset.dpia.vereist.every(geldt) && regelset.dpia.minstens_een_van.some(geldt)) ||
    regelset.dpia.altijd_bij.some(geldt);
  const aiActSignaal = regelset.ai_act.minstens_een_van.some(geldt);

  // 3. Hoogste kleur over checks en rode vlaggen. Een AI Act-signaal verhoogt de uitkomst
  //    tot minstens de ingestelde kleur, zodat de compliance officer altijd meekijkt.
  let hoogste = 0;
  for (const s of checkScores) hoogste = Math.max(hoogste, rangVan(s.kleur));
  if (vlaggenJa.length > 0) hoogste = Math.max(hoogste, rangVan(regelset.rode_vlag_kleur));
  const minimum = aiActSignaal && regelset.ai_act.minimale_uitkomst ? rangVan(regelset.ai_act.minimale_uitkomst) : 0;
  const verhoogdDoorAiAct = minimum > hoogste;
  hoogste = Math.max(hoogste, minimum);
  const kleur: Kleur = regelset.kleuren[hoogste]!;

  // 4. Wat gaf de doorslag? Alle checks en vlaggen met de hoogste kleur (en eventueel het signaal).
  const doorslagChecks = checkScores.filter((s) => s.kleur === kleur.id);
  const doorslagVlaggen = regelset.rode_vlag_kleur === kleur.id ? vlaggenJa : [];
  const redenen: Reden[] = [
    ...(verhoogdDoorAiAct
      ? [{ soort: "signaal", signaal: "ai_act", tekst: regelset.ai_act.motivatie ?? "AI Act-classificatie nodig" } as Reden]
      : []),
    ...doorslagVlaggen.map((v): Reden => ({ soort: "rode_vlag", vlagId: v.id, kort: v.kort })),
    ...doorslagChecks.flatMap((s) =>
      s.bepalend.map(
        (k): Reden => ({
          soort: "check",
          checkId: s.check.id,
          checkNaam: s.check.naam,
          ...(k.deelvraag ? { deelvraagId: k.deelvraag.id, deelvraagNaam: k.deelvraag.naam } : {}),
          antwoordId: k.antwoord.id,
          antwoordLabel: k.antwoord.kort ?? k.antwoord.label,
        }),
      ),
    ),
  ];

  // 5. Toetsers, zoals ingesteld bij de kleur.
  let toetsers: string[] = [];
  if (kleur.toetsers === "alle") {
    toetsers = regelset.toetsers.map((t) => t.id);
  } else if (kleur.toetsers === "per_check") {
    const nodig = new Set(doorslagChecks.map((s) => s.check.toetser));
    if (dpiaSignaal) nodig.add(regelset.dpia.toetser);
    if (aiActSignaal) nodig.add(regelset.ai_act.toetser);
    toetsers = regelset.toetsers.map((t) => t.id).filter((t) => nodig.has(t));
  }

  // 6. Voorwaarden (alleen bij een accountaanvraag met voorwaarden).
  const voorwaarden =
    kleur.vervolgactie === "accountaanvraag_met_voorwaarden"
      ? uniek(doorslagChecks.flatMap((s) => s.bepalend.map((k) => k.antwoord.voorwaarde)).filter(isTekst))
      : [];

  // 7. Alternatieven (alleen als er geen aanvraag mogelijk is). Geen alternatief → eventueel contact.
  const alternatieven =
    kleur.vervolgactie === "alleen_vastleggen"
      ? uniek(
          [
            ...doorslagVlaggen.map((v) => v.alternatief),
            ...doorslagChecks.flatMap((s) => s.bepalend.map((k) => k.antwoord.alternatief)),
          ].filter(isTekst),
        )
      : [];
  const contactNodig = kleur.contact_als_geen_alternatief && alternatieven.length === 0;

  return {
    regelversie: regelset.versie,
    kleur: kleur.id,
    uitkomst: kleur.uitkomst,
    vervolgactie: kleur.vervolgactie,
    redenen,
    motivatie: maakMotivatie(kleur, redenen, regelset),
    toetsers,
    dpiaSignaal,
    aiActSignaal,
    voorwaarden,
    alternatieven,
    contactNodig,
  };
}

/** Bouwt de zin voor "Waarom deze kleur?", bijvoorbeeld "Persoonsgegevens (Data) en Serieus (Impact – Beschikbaarheid)." */
export function maakMotivatie(kleur: Kleur, redenen: Reden[], regelset: Regelset): string {
  const delen = redenen.map((r) =>
    r.soort === "check"
      ? `${r.antwoordLabel} (${r.checkNaam}${r.deelvraagNaam ? ` – ${r.deelvraagNaam}` : ""})`
      : r.soort === "signaal"
        ? r.tekst
        : regelset.motivatie_rode_vlag.replace("{kort}", r.kort),
  );
  const tekst = kleur.motivatie.replace("{redenen}", opsomming(delen));
  return hoofdletter(tekst);
}

function gekozenKeuzes(check: Check, invoer: BeslisInvoer): Keuze[] {
  // Na valideerInvoer bestaat elk gekozen antwoord en is alles beantwoord.
  const vind = (id: string) => check.antwoorden.find((a) => a.id === id)!;
  if (check.deelvragen.length > 0) {
    return check.deelvragen.map((d) => ({ deelvraag: d, antwoord: vind(deelvraagAntwoord(invoer, check.id, d.id)!) }));
  }
  const ids = gekozenIds(invoer, check.id);
  return check.antwoorden.filter((a) => ids.includes(a.id)).map((antwoord) => ({ antwoord }));
}

function conditieGeldt(c: Conditie, invoer: BeslisInvoer, regelset: Regelset): boolean {
  if ("extra_vraag" in c) {
    // Een antwoord op een extra vraag telt alleen als die vraag van toepassing is.
    return extraVraagVanToepassing(c.extra_vraag, invoer, regelset) && invoer.extraVragen?.[c.extra_vraag] === true;
  }
  if ("rode_vlag" in c) return invoer.rodeVlaggen[c.rode_vlag] === true;
  if (c.deelvraag) {
    const a = deelvraagAntwoord(invoer, c.check, c.deelvraag);
    return a !== undefined && c.antwoorden.includes(a);
  }
  // Zonder deelvraag: één van de gekozen antwoorden (bij deelvragen: één van de deelscores) staat in de lijst.
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

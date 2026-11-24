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
 * - Bij een tool buiten de IJK Toolbox is de uitkomst minstens de ingestelde kleur (oranje),
 *   en gaat de aanvraag naar de ingestelde toetsers.
 * - Privacy (pre-DPIA) en AI-risico zijn twee aparte beoordelingen (zie verdieping.ts). Hun klasse kan de
 *   uitkomst verhogen tot een minimale kleur (regelset: dpia.klassen en ai_risico.klassen).
 */
import type { Antwoord, Check, Deelvraag, Kleur, Regelset, Vervolgactie } from "./content-schema";
import { analyseer, evalueerAi, evalueerDpia, type AiUitkomst, type DpiaUitkomst, type Feit } from "./verdieping";

/** Antwoord op een extra vraag: ja, nee, of (als de vraag dat toestaat) "weet ik niet zeker". */
export type ExtraAntwoord = boolean | "onzeker";

/** Is dit een geldig antwoord op deze extra vraag? */
export function geldigExtraAntwoord(w: unknown, onzekerMogelijk: boolean): w is ExtraAntwoord {
  return typeof w === "boolean" || (onzekerMogelijk && w === "onzeker");
}

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
  extraVragen?: Record<string, ExtraAntwoord>;
  /** rode-vlag-id → ja/nee. Elke rode vlag die van toepassing is, moet beantwoord zijn. */
  rodeVlaggen: Record<string, boolean>;
  /** Verdiepingsvragen (privacy en AI): gegeven-id → antwoord-id. Alleen relevante vragen tellen mee. */
  verdieping?: Record<string, string>;
  /** Koos de medewerker een tool die (nog) niet in de IJK Toolbox zit? */
  toolBuitenToolbox?: boolean;
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
  /** Een beoordeling (tool buiten de toolbox, privacy, AI) die de uitkomst naar een minimale kleur verhoogde. */
  | { soort: "signaal"; signaal: "tool_buiten_toolbox" | "dpia" | "ai_risico"; tekst: string };

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
  /** Privacy: de DPIA-klasse is minstens "waarschijnlijk" (een klasse met een minimale uitkomst). */
  dpiaSignaal: boolean;
  /** AI: het hoogste AI-risico (de compliance officer classificeert volgens de AI Act). */
  aiActSignaal: boolean;
  dpia: DpiaUitkomst;
  aiRisico: AiUitkomst;
  /** Alle feiten met herkomst (traceerbaarheid). */
  feiten: Feit[];
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

/** Wordt deze aanvullende vraag gesteld? (Sommige alleen bij een bepaald antwoord op een check.) */
export function rodeVlagVanToepassing(vlagId: string, invoer: BeslisInvoer, regelset: Regelset): boolean {
  const v = regelset.rode_vlaggen.find((x) => x.id === vlagId);
  if (!v) return false;
  if (!v.toon_bij) return true;
  return gekozenIds(invoer, v.toon_bij.check).some((id) => v.toon_bij!.antwoorden.includes(id));
}

/** De rode vlaggen zoals ze meetellen: een vraag die niet gesteld wordt, telt als "nee". */
function rodeVlaggenDieTellen(invoer: BeslisInvoer, regelset: Regelset): Record<string, boolean> {
  const uit: Record<string, boolean> = {};
  for (const v of regelset.rode_vlaggen) uit[v.id] = rodeVlagVanToepassing(v.id, invoer, regelset) && invoer.rodeVlaggen?.[v.id] === true;
  return uit;
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
    if (!geldigExtraAntwoord(invoer.extraVragen?.[extra.id], extra.onzeker_mogelijk)) {
      fouten.push(`extra vraag "${extra.id}" is niet beantwoord`);
    }
  }

  const vlagIds = new Set(regelset.rode_vlaggen.map((v) => v.id));
  for (const id of Object.keys(invoer.rodeVlaggen ?? {})) {
    if (!vlagIds.has(id)) fouten.push(`onbekende rode vlag "${id}"`);
  }
  for (const vlag of regelset.rode_vlaggen) {
    if (!rodeVlagVanToepassing(vlag.id, invoer, regelset)) continue;
    if (typeof invoer.rodeVlaggen?.[vlag.id] !== "boolean") fouten.push(`rode vlag "${vlag.id}" is niet beantwoord`);
  }

  // Verdieping (privacy en AI): alleen de vragen die nu relevant zijn en niet uit eerdere antwoorden volgen.
  const v = analyseer({ ...invoer, rodeVlaggen: rodeVlaggenDieTellen(invoer, regelset) }, regelset);
  fouten.push(...v.fouten);
  for (const q of v.vragen) if (q.antwoord === undefined) fouten.push(`vraag "${q.gegeven.id}" is niet beantwoord`);
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
  const vlaggen = rodeVlaggenDieTellen(invoer, regelset);
  const vlaggenJa = regelset.rode_vlaggen.filter((v) => vlaggen[v.id]);

  // 2. Privacy (pre-DPIA) en AI-risico: aparte beoordelingen op dezelfde feiten.
  const analyse = analyseer({ ...invoer, rodeVlaggen: vlaggen }, regelset);
  const dpia = evalueerDpia(analyse, regelset);
  const aiRisico = evalueerAi(analyse, regelset);
  const dpiaKlasse = regelset.dpia.klassen.find((k) => k.id === dpia.klasse);
  const aiKlasse = regelset.ai_risico.klassen.find((k) => k.id === aiRisico.klasse);
  const dpiaSignaal = !!dpiaKlasse?.minimale_uitkomst;
  const aiActSignaal = !!aiKlasse && aiKlasse.id === regelset.ai_risico.klassen[regelset.ai_risico.klassen.length - 1]!.id;

  // 3. Hoogste kleur over checks en rode vlaggen. Een tool buiten de toolbox en de klassen van privacy en AI
  //    verhogen de uitkomst tot minstens de ingestelde kleur.
  let hoogste = 0;
  for (const s of checkScores) hoogste = Math.max(hoogste, rangVan(s.kleur));
  if (vlaggenJa.length > 0) hoogste = Math.max(hoogste, rangVan(regelset.rode_vlag_kleur));
  const buiten = invoer.toolBuitenToolbox === true;
  type Minimum = { signaal: "tool_buiten_toolbox" | "dpia" | "ai_risico"; rang: number; tekst: string; toetsers: string[] };
  const minima: Minimum[] = [];
  if (buiten) {
    const tb = regelset.tool_buiten_toolbox;
    minima.push({ signaal: "tool_buiten_toolbox", rang: rangVan(tb.minimale_uitkomst), tekst: tb.motivatie, toetsers: tb.toetsers });
  }
  if (dpiaKlasse?.minimale_uitkomst) {
    minima.push({
      signaal: "dpia",
      rang: rangVan(dpiaKlasse.minimale_uitkomst),
      tekst: regelset.dpia.motivatie.replace("{klasse}", dpiaKlasse.naam).replace("{aantal}", String(dpia.score)),
      toetsers: [regelset.dpia.toetser],
    });
  }
  if (aiKlasse?.minimale_uitkomst) {
    minima.push({
      signaal: "ai_risico",
      rang: rangVan(aiKlasse.minimale_uitkomst),
      tekst: regelset.ai_risico.motivatie.replace("{klasse}", aiKlasse.naam),
      toetsers: [regelset.ai_risico.toetser],
    });
  }
  const verhogers = minima.filter((m) => m.rang > hoogste);
  for (const m of minima) hoogste = Math.max(hoogste, m.rang);
  const kleur: Kleur = regelset.kleuren[hoogste]!;

  // 4. Wat gaf de doorslag? Alle checks en vlaggen met de hoogste kleur (en eventueel de signalen).
  const doorslagChecks = checkScores.filter((s) => s.kleur === kleur.id);
  const doorslagVlaggen = regelset.rode_vlag_kleur === kleur.id ? vlaggenJa : [];
  const redenen: Reden[] = [
    ...verhogers
      .filter((m) => m.rang === hoogste)
      .map((m): Reden => ({ soort: "signaal", signaal: m.signaal, tekst: m.tekst })),
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
    // Toetsers van de beoordelingen die minstens een kleur met toetsers vragen (privacy, AI, tool buiten de toolbox).
    for (const m of minima) {
      if (regelset.kleuren[m.rang]!.toetsers !== "geen") for (const t of m.toetsers) nodig.add(t);
    }
    toetsers = regelset.toetsers.map((t) => t.id).filter((t) => nodig.has(t));
  }

  // 6. Voorwaarden (alleen bij een accountaanvraag met voorwaarden).
  const voorwaarden =
    kleur.vervolgactie === "accountaanvraag_met_voorwaarden"
      ? uniek(
          [
            ...doorslagChecks.flatMap((s) => s.bepalend.map((k) => k.antwoord.voorwaarde)),
            // AI-risico "beperkt": de voorwaarden bij de antwoorden die het risico bepaalden.
            ...aiRisico.redenen.map((r) => r.voorwaarde),
          ].filter(isTekst),
        )
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
    dpia,
    aiRisico,
    feiten: analyse.feiten,
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

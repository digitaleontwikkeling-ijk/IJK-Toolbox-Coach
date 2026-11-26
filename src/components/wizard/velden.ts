/**
 * De vragen van stap 3, los van de weergave. De lijst (Stap3) en het gesprek (Gesprek) gebruiken allebei
 * deze functies, zodat ze precies dezelfde vragen stellen.
 *
 * Welke verdiepingsvragen (privacy en AI) nodig zijn, bepaalt `analyseer` in het domein: wat al uit eerdere
 * antwoorden volgt, wordt niet gevraagd. Hier wordt alleen vertaald naar velden en beurten.
 */
import type { Check } from "@/domain/content-schema";
import { geldigExtraAntwoord, rodeVlagVanToepassing } from "@/domain/beslisregels";
import { analyseer, type Feit } from "@/domain/verdieping";
import type { WizardData } from "@/domain/wizard";
import type { ContentDto } from "../client";

type Data = WizardData;
type Content = ContentDto;

export const JA_NEE = [
  { id: "ja", label: "Ja" },
  { id: "nee", label: "Nee" },
];
export const ONZEKER = { id: "onzeker", label: "Weet ik niet zeker" };
export const naarJaNee = (b: boolean | undefined) => (b === undefined ? undefined : b ? "ja" : "nee");
const vanJaNee = (w: boolean | "onzeker" | undefined) => (w === "onzeker" ? "onzeker" : naarJaNee(w));
const naarWaarde = (id: string): boolean | "onzeker" => (id === "onzeker" ? "onzeker" : id === "ja");

/** De gekozen antwoorden van een check altijd als lijst (bij deelvragen: alle deelantwoorden). */
export const alsLijst = (w: string | string[] | Record<string, string> | undefined): string[] =>
  Array.isArray(w) ? w : typeof w === "string" ? (w ? [w] : []) : w ? Object.values(w) : [];

const perDeelVan = (w: Data["checks"][string] | undefined): Record<string, string> =>
  w && typeof w === "object" && !Array.isArray(w) ? w : {};

/** De verdieping bij de huidige antwoorden (pure berekening uit het domein). */
export function verdiepingVan(content: Content, data: Data) {
  const r = content.regelset;
  const invoer = { checks: data.checks, extraVragen: data.extraVragen, rodeVlaggen: {}, verdieping: data.verdieping };
  const vlaggen = Object.fromEntries(
    r.rode_vlaggen.filter((v) => rodeVlagVanToepassing(v.id, invoer, r)).map((v) => [v.id, data.rodeVlaggen[v.id] === true]),
  );
  return analyseer({ ...invoer, rodeVlaggen: vlaggen }, r);
}

/** De aanvullende vragen die nu gesteld worden, met hun volgnummer. */
export function zichtbareVlaggen(content: Content, data: Data) {
  const invoer = { checks: data.checks, rodeVlaggen: data.rodeVlaggen };
  return content.regelset.rode_vlaggen
    .filter((v) => rodeVlagVanToepassing(v.id, invoer, content.regelset))
    .map((v, i) => ({ vlag: v, nummer: i + 1 }));
}

/** De extra vragen bij een check die bij de gekozen antwoorden horen. */
export function extraVragenBij(content: Content, c: Check, gekozen: string[]) {
  return content.regelset.extra_vragen.filter((e) => e.check === c.id && gekozen.some((g) => e.toon_bij.includes(g)));
}

/** Alle vragen van stap 3 die nu gesteld worden: [veld-id, leesbare naam, beantwoord]. */
export function alleVelden(content: Content, data: Data): { id: string; naam: string; beantwoord: boolean }[] {
  const r = content.regelset;
  const uit: { id: string; naam: string; beantwoord: boolean }[] = [];
  const verdieping = verdiepingVan(content, data);
  for (const c of r.checks) {
    const huidig = data.checks[c.id];
    if (c.deelvragen.length > 0) {
      const perDeel = perDeelVan(huidig);
      for (const d of c.deelvragen) uit.push({ id: `${c.id}-${d.id}`, naam: `${c.nummer}. ${c.naam} – ${d.naam}`, beantwoord: !!perDeel[d.id] });
    } else {
      uit.push({ id: c.id, naam: `${c.nummer}. ${c.naam}`, beantwoord: alsLijst(huidig).length > 0 });
    }
    for (const e of extraVragenBij(content, c, alsLijst(huidig))) {
      uit.push({ id: e.id, naam: e.vraag, beantwoord: geldigExtraAntwoord(data.extraVragen[e.id], e.onzeker_mogelijk) });
    }
    for (const v of verdieping.vragen.filter((x) => x.gegeven.plek === c.id)) {
      uit.push({ id: v.gegeven.id, naam: v.gegeven.vraag, beantwoord: v.antwoord !== undefined });
    }
  }
  for (const { vlag: v, nummer } of zichtbareVlaggen(content, data)) {
    uit.push({
      id: v.id,
      naam: content.teksten.aanvullende_vragen.vraag_label.replace("{nummer}", String(nummer)),
      beantwoord: geldigExtraAntwoord(data.rodeVlaggen[v.id], true),
    });
  }
  return uit;
}

/** Welke velden van stap 3 ontbreken nog? Geeft [veld-id, leesbare naam]. */
export function ontbrekendeVelden(content: Content, data: Data): [string, string][] {
  return alleVelden(content, data)
    .filter((v) => !v.beantwoord)
    .map((v) => [v.id, v.naam]);
}

// ---------- Het gesprek: één vraag per beurt ----------

export interface Voorstel {
  antwoord: string;
  zekerheid: "hoog" | "middel" | "laag";
  /** coach = op basis van de beschrijving; tool = omdat de gekozen tool AI gebruikt. */
  bron: "coach" | "tool";
  vervolgvraag?: string;
}

/** Eén vraag in het gesprek. Het veld-id is hetzelfde als in de lijst (`alleVelden`). */
export interface Beurt {
  id: string;
  /** De check waar de vraag bij hoort, of null bij de aanvullende vragen. */
  check: Check | null;
  /** Kop boven de vraag, bijvoorbeeld "Check 2 van 6 · Data". */
  kop: string;
  vraag: string;
  /** Korte zin onder de vraag (waarom we het vragen, of de vraag bij een check). */
  uitleg?: string;
  /** Inleiding van de coach vóór de vraag (bijvoorbeeld waarom er privacyvragen komen). */
  intro?: string;
  opties: { id: string; label: string; uitleg?: string }[];
  meerdere: boolean;
  gekozen: string[];
  voorstel?: Voorstel;
  /** Zet het antwoord (lijst met antwoord-id's) in de wizardgegevens. */
  zet: (d: Data, ids: string[]) => Data;
}

/** Alle beurten van het gesprek, in de volgorde waarin de coach ze stelt. */
export function beurten(content: Content, data: Data): Beurt[] {
  const r = content.regelset;
  const t = content.teksten;
  const verdieping = verdiepingVan(content, data);
  const uit: Beurt[] = [];
  const kopCheck = (c: Check) =>
    t.gesprek.kop_check.replace("{nummer}", String(c.nummer)).replace("{totaal}", String(r.checks.length)).replace("{naam}", c.naam);
  const coach = (sleutel: string): Voorstel | undefined => {
    const v = data.coachVoorstellen[sleutel];
    return v && { antwoord: v.voorstel, zekerheid: v.zekerheid, bron: sleutel.startsWith("tool.") ? "tool" : "coach", vervolgvraag: v.vervolgvraag };
  };
  // In het gesprek geen zinnen over waarom een vraag komt; alleen uitleg die zegt wat er bedoeld wordt (definitie of
  // voorbeeld), voor de vragen in teksten.yaml (gesprek.uitleg_bij). De coach krijgt alle uitleg wel mee in de chat.
  const uitlegBij = new Set(t.gesprek.uitleg_bij);

  for (const c of r.checks) {
    const huidig = data.checks[c.id];
    if (c.deelvragen.length > 0) {
      const perDeel = perDeelVan(huidig);
      c.deelvragen.forEach((d, i) =>
        uit.push({
          id: `${c.id}-${d.id}`,
          check: c,
          kop: `${kopCheck(c)} – ${d.naam}`,
          vraag: d.vraag,
          uitleg: i === 0 ? c.vraag : undefined,
          opties: c.antwoorden.map((a) => ({ id: a.id, label: a.label })),
          meerdere: false,
          gekozen: perDeel[d.id] ? [perDeel[d.id]!] : [],
          voorstel: coach(`${c.id}.${d.id}`),
          zet: (x, ids) => ({ ...x, checks: { ...x.checks, [c.id]: { ...perDeelVan(x.checks[c.id]), [d.id]: ids[0]! } } }),
        }),
      );
    } else {
      uit.push({
        id: c.id,
        check: c,
        kop: kopCheck(c),
        vraag: c.vraag,
        opties: c.antwoorden.map((a) => ({ id: a.id, label: a.label, uitleg: a.uitleg })),
        meerdere: c.meerdere,
        gekozen: alsLijst(huidig),
        voorstel: coach(c.id),
        zet: (x, ids) => ({ ...x, checks: { ...x.checks, [c.id]: c.meerdere ? ids : ids[0]! } }),
      });
    }

    for (const e of extraVragenBij(content, c, alsLijst(huidig))) {
      const w = vanJaNee(data.extraVragen[e.id]);
      uit.push({
        id: e.id,
        check: c,
        kop: kopCheck(c),
        vraag: e.vraag,
        uitleg: uitlegBij.has(e.id) ? e.uitleg : undefined,
        opties: e.onzeker_mogelijk ? [...JA_NEE, ONZEKER] : JA_NEE,
        meerdere: false,
        gekozen: w ? [w] : [],
        zet: (x, ids) => ({ ...x, extraVragen: { ...x.extraVragen, [e.id]: naarWaarde(ids[0]!) } }),
      });
    }

    // Verdiepingsvragen: eerst basis en privacy, daarna de AI-groep (zoals in de lijst).
    const hier = verdieping.vragen.filter((v) => v.gegeven.plek === c.id);
    for (const v of [...hier.filter((x) => x.gegeven.spoor !== "ai"), ...hier.filter((x) => x.gegeven.spoor === "ai")]) {
      const g = v.gegeven;
      uit.push({
        id: g.id,
        check: c,
        kop: kopCheck(c),
        vraag: g.vraag,
        uitleg: uitlegBij.has(g.id) ? g.uitleg : undefined,
        opties: g.antwoorden,
        meerdere: false,
        gekozen: v.antwoord ? [v.antwoord] : [],
        voorstel: coach(`tool.${g.id}`),
        zet: (x, ids) => ({ ...x, verdieping: { ...x.verdieping, [g.id]: ids[0]! } }),
      });
    }
  }

  for (const { vlag: v, nummer } of zichtbareVlaggen(content, data)) {
    const w = vanJaNee(data.rodeVlaggen[v.id]);
    uit.push({
      id: v.id,
      check: null,
      kop: t.gesprek.kop_aanvullend.replace("{nummer}", String(nummer)),
      vraag: v.vraag,
      intro: nummer === 1 ? t.aanvullende_vragen.intro : undefined,
      opties: [...JA_NEE, ONZEKER],
      meerdere: false,
      gekozen: w ? [w] : [],
      zet: (x, ids) => ({ ...x, rodeVlaggen: { ...x.rodeVlaggen, [v.id]: naarWaarde(ids[0]!) } }),
    });
  }
  return uit;
}

/** Staat het antwoord nog precies op het voorstel (coach of tool)? Dan moet de medewerker het bevestigen. */
export function isVoorstel(b: Beurt): boolean {
  return !!b.voorstel && b.gekozen.length === 1 && b.gekozen[0] === b.voorstel.antwoord;
}

/** Een beurt is afgerond als er een antwoord is en de medewerker het in het gesprek heeft bevestigd. */
export function isAfgerond(b: Beurt, data: Data): boolean {
  return b.gekozen.length > 0 && data.bevestigd.includes(b.id);
}

/**
 * Terug van de lijst naar het gesprek: eigen antwoorden uit de lijst gelden als bevestigd.
 * Een antwoord dat nog precies het voorstel van de coach is, vraagt de coach wel na.
 */
export function bevestigEigenAntwoorden(content: Content, data: Data): Data {
  const eigen = beurten(content, data).filter((b) => b.gekozen.length > 0 && !isVoorstel(b)).map((b) => b.id);
  return { ...data, bevestigd: [...new Set([...data.bevestigd, ...eigen])] };
}

/** Wat de coach niet hoeft te vragen omdat het uit eerdere antwoorden volgt, per check (plek van de vraag). */
export function afgeleidBij(content: Content, data: Data, checkId: string): { feit: Feit; vraag: string; antwoord: string }[] {
  const r = content.regelset;
  return verdiepingVan(content, data)
    .feiten.filter((f) => f.herkomst === "afgeleid")
    .flatMap((f) => {
      const g = r.gegevens.find((x) => x.id === f.id);
      if (!g || g.plek !== checkId) return [];
      const antwoord = g.antwoorden.find((a) => a.id === f.waarde)?.label ?? (f.waarde === "ja" ? "Ja" : f.waarde === "nee" ? "Nee" : f.waarde);
      return [{ feit: f, vraag: g.vraag, antwoord }];
    });
}

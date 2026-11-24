/**
 * Verdieping: privacy (pre-DPIA) en AI-risico, geïntegreerd in de zes checks (regelset 0.8).
 *
 * PURE functies, net als de beslisregels. Eén plek voor:
 * - het afleiden van feiten uit de bestaande antwoorden (REUSE),
 * - het bepalen welke vragen nog nodig zijn, eventueel als verduidelijking (REFINE) of nieuw (ASK),
 * - de DPIA-telling en het AI-risico.
 *
 * Bron van waarheid blijven de antwoorden van de medewerker (checks, extra vragen, aanvullende vragen en
 * de verdiepingsvragen). Feiten worden daar altijd opnieuw uit berekend: er is geen losse, verouderde state.
 * Een antwoord op een vraag die niet (meer) relevant is, telt niet mee.
 *
 * Categorieën van afleidingen (zie docs/analyse-privacy-ai.md, §4):
 *   deterministisch  het bestaande antwoord betekent hetzelfde → de vraag wordt niet gesteld.
 *   signaal          het bestaande antwoord suggereert iets → de vraag wordt gesteld met een korte inleiding.
 *   (geen relatie)   de vraag wordt gewoon gesteld.
 */
import type { Gegeven, GegevenId, Regelset } from "./content-schema";

/** De antwoorden die de verdieping leest (een deel van de invoer van de beslisregels). */
export interface VerdiepingInvoer {
  checks: Record<string, string | string[] | Record<string, string>>;
  extraVragen?: Record<string, boolean | "onzeker">;
  rodeVlaggen: Record<string, boolean>;
  /** gegeven-id → antwoord-id */
  verdieping?: Record<string, string>;
}

export type Beoordeling = "toolbox" | "dpia" | "ai";

/** Eén feit over de toepassing, met herkomst (voor de traceerbaarheid). */
export interface Feit {
  id: string;
  waarde: string;
  /** Waar het feit vandaan komt, bijvoorbeeld "check.autonomie", "verdieping.ai_invloed" of "extra_vraag.…". */
  bron: string;
  /** expliciet = de medewerker beantwoordde deze vraag; afgeleid = uit een ander antwoord. */
  herkomst: "expliciet" | "afgeleid";
  /** Bij afgeleid: hoe zeker. Afleidingen zijn hier altijd deterministisch (anders wordt er gevraagd). */
  zekerheid: "zeker" | "deterministisch";
  gebruiktDoor: Beoordeling[];
  /** Leesbare uitleg van de herkomst, bijvoorbeeld "afgeleid uit Autonomie: Beslissen (over mensen)". */
  toelichting: string;
}

/** Een vraag die (nu) gesteld moet worden. */
export interface OpenVraag {
  gegeven: Gegeven;
  /** Er is al gedeeltelijke informatie: toon de inleiding (verduidelijking in plaats van een nieuwe vraag). */
  signaal: boolean;
  /** Het huidige (geldige) antwoord, als dat er is. */
  antwoord: string | undefined;
}

export interface DpiaUitkomst {
  /** Alleen bij persoonsgegevens of als de medewerker het niet zeker weet. */
  actief: boolean;
  score: number;
  klasse: string | null;
  klasseNaam: string | null;
  indicatoren: { id: string; naam: string; waarde: string; telt: boolean; feit: Feit }[];
}

export interface AiUitkomst {
  /** Alleen als de oplossing AI gebruikt (of als de medewerker het niet zeker weet). */
  actief: boolean;
  klasse: string | null;
  klasseNaam: string | null;
  /** De antwoorden die het risico verhoogden (de klasse is de hoogste hiervan). */
  redenen: { gegeven: string; naam: string; antwoord: string; antwoordLabel: string; klasse: string; voorwaarde?: string; feit: Feit }[];
  domein: string | null;
}

export interface VerdiepingAnalyse {
  dpiaActief: boolean;
  aiActief: boolean;
  /** Alle bekende, relevante feiten (ook de feiten uit de checks), met herkomst en gebruik. */
  feiten: Feit[];
  /** Vragen die nu relevant zijn en niet uit eerdere antwoorden volgen, in de volgorde van de regelset. */
  vragen: OpenVraag[];
  /** Fouten in de invoer (onbekende vraag of antwoord); ontbrekende antwoorden staan in `vragen`. */
  fouten: string[];
}

// ---------- Hulpfuncties ----------

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function gekozen(invoer: VerdiepingInvoer, checkId: string): string[] {
  const ruw = invoer.checks?.[checkId];
  const lijst = isObject(ruw) ? Object.values(ruw) : Array.isArray(ruw) ? ruw : ruw ? [ruw] : [];
  return lijst.filter((x): x is string => typeof x === "string" && x !== "");
}

const heeftEen = (lijst: string[], ...ids: string[]) => lijst.some((x) => ids.includes(x));
const alleenUit = (lijst: string[], ...ids: string[]) => lijst.length > 0 && lijst.every((x) => ids.includes(x));

function labelVan(regelset: Regelset, checkId: string, ids: string[]): string {
  const c = regelset.checks.find((x) => x.id === checkId);
  const namen = ids.map((id) => c?.antwoorden.find((a) => a.id === id)?.label ?? id);
  return `${c?.naam ?? checkId}: ${namen.join(", ")}`;
}

// ---------- Afleidingen per gegeven (de enige plek waar deze logica staat) ----------

interface Context {
  invoer: VerdiepingInvoer;
  regelset: Regelset;
  autonomie: string[];
  systemen: string[];
  gebruikers: string[];
  afhankelijkheid: string[];
  impact: string[];
  /** Waarde van een gegeven dat al bekend is (afgeleid of beantwoord). */
  waarde: (id: string) => string | undefined;
}

interface Afleiding {
  waarde: string;
  bron: string;
  toelichting: string;
}

interface Regel {
  /** Is de vraag in deze situatie relevant? (bij false: niet vragen en niet meetellen) */
  relevant: (c: Context) => boolean;
  /** Deterministische afleiding: de vraag wordt niet gesteld. */
  afleiden?: (c: Context) => Afleiding | null;
  /** Sterk signaal, maar onvoldoende: de vraag wordt gesteld als verduidelijking. */
  signaal?: (c: Context) => boolean;
}

const dpiaActief = (c: Context) => c.waarde("persoonsgegevens") === "ja" || c.waarde("persoonsgegevens") === "onzeker";
const aiActief = (c: Context) => c.waarde("ai_gebruik") === "ja" || c.waarde("ai_gebruik") === "weet_niet";
/** AI-vragen over betrokkenen alleen als de AI mensen raakt (B5). Nog onbekend = nog niet tonen. */
const raaktMensen = (c: Context) => aiActief(c) && c.waarde("ai_invloed") !== undefined && c.waarde("ai_invloed") !== "nee";

const uitAutonomie = (c: Context, waarde: string, ids: string[]): Afleiding => ({
  waarde,
  bron: "check.autonomie",
  toelichting: `afgeleid uit ${labelVan(c.regelset, "autonomie", ids)}`,
});

const REGELS: Record<GegevenId, Regel> = {
  // Basis: altijd vragen. Eén antwoord voor DPIA-indicator 7 én voor het AI-spoor.
  ai_gebruik: { relevant: () => true },

  kwetsbare_groepen: { relevant: dpiaActief },
  koppeling_datasets: {
    relevant: dpiaActief,
    // Deterministisch: geen systemen → er worden geen bronnen gekoppeld.
    afleiden: (c) =>
      alleenUit(c.systemen, "geen")
        ? { waarde: "nee", bron: "check.systemen", toelichting: `afgeleid uit ${labelVan(c.regelset, "systemen", ["geen"])}` }
        : null,
    // Signaal: koppelen of schrijven betekent niet automatisch dat persoonsgegevens worden gecombineerd.
    signaal: (c) => heeftEen(c.systemen, "koppelen", "schrijven"),
  },
  grote_schaal: {
    relevant: dpiaActief,
    // Signaal: het aantal gebruikers is niet de omvang van de verwerking.
    signaal: (c) => heeftEen(c.gebruikers, "organisatie", "extern") || heeftEen(c.afhankelijkheid, "team", "bedrijf"),
  },
  profilering: {
    relevant: dpiaActief,
    // Deterministisch: beslissen over mensen is een beoordeling van personen.
    afleiden: (c) => (heeftEen(c.autonomie, "beslissen") ? uitAutonomie(c, "ja", ["beslissen"]) : null),
  },
  geautomatiseerd_besluit: {
    relevant: dpiaActief,
    afleiden: (c) => {
      if (heeftEen(c.autonomie, "beslissen")) return uitAutonomie(c, "ja", ["beslissen"]);
      // Deterministisch: alleen assisteren, adviseren of lezen → de oplossing besluit niets zelf.
      if (alleenUit(c.autonomie, "assisteren", "adviseren", "lezen")) return uitAutonomie(c, "nee", c.autonomie);
      return null;
    },
    // Signaal: schrijven of handelen is niet altijd een besluit over mensen.
    signaal: (c) => heeftEen(c.autonomie, "schrijven", "handelen"),
  },
  significante_gevolgen: {
    relevant: dpiaActief,
    afleiden: (c) =>
      c.invoer.rodeVlaggen?.ai_beslist_over_mensen === true
        ? { waarde: "ja", bron: "rode_vlag.ai_beslist_over_mensen", toelichting: "afgeleid uit: AI beslist zelfstandig over mensen, met grote gevolgen" }
        : null,
    // Signaal: "Groot" zegt niet waarom (geen betrouwbare relatie met gevolgen voor personen).
    signaal: (c) => heeftEen(c.impact, "serieus", "groot"),
  },

  ai_invloed: {
    relevant: aiActief,
    afleiden: (c) => {
      if (heeftEen(c.autonomie, "beslissen")) return uitAutonomie(c, "direct", ["beslissen"]);
      // Deterministisch: alleen assisteren → de mens doet het werk; de AI raakt niemands rechten.
      if (alleenUit(c.autonomie, "assisteren")) return uitAutonomie(c, "nee", ["assisteren"]);
      return null;
    },
    signaal: (c) => heeftEen(c.autonomie, "adviseren"),
  },
  ai_doorslaggevend: {
    relevant: raaktMensen,
    afleiden: (c) => {
      if (heeftEen(c.autonomie, "beslissen")) return uitAutonomie(c, "doorslaggevend", ["beslissen"]);
      // "Ja, direct" is gedefinieerd als: de uitkomst beslist of weegt zwaar mee.
      if (c.waarde("ai_invloed") === "direct") {
        return { waarde: "doorslaggevend", bron: "verdieping.ai_invloed", toelichting: "afgeleid uit: de AI raakt mensen direct" };
      }
      return null;
    },
    signaal: (c) => heeftEen(c.autonomie, "adviseren"),
  },
  ai_domein: { relevant: raaktMensen },
  ai_discriminatie: { relevant: raaktMensen },
  ai_herziening: { relevant: raaktMensen },
  // Ook bij externe gebruikers: die moeten weten dat ze met AI te maken hebben.
  ai_transparantie: { relevant: (c) => raaktMensen(c) || (aiActief(c) && heeftEen(c.gebruikers, "extern")) },
  ai_toezicht: { relevant: raaktMensen },
  ai_uitlegbaarheid: { relevant: aiActief },
};

const GEBRUIKT_DOOR: Record<string, Beoordeling[]> = {
  persoonsgegevens: ["toolbox", "dpia"],
  bijzondere_persoonsgegevens: ["dpia"],
  ai_gebruik: ["dpia", "ai"],
};
const gebruiktDoor = (g: Gegeven): Beoordeling[] => GEBRUIKT_DOOR[g.id] ?? [g.spoor === "ai" ? "ai" : "dpia"];

// ---------- Analyse ----------

/** Leidt de feiten af en bepaalt welke vragen (nog) nodig zijn. */
export function analyseer(invoer: VerdiepingInvoer, regelset: Regelset): VerdiepingAnalyse {
  const antwoorden = invoer.verdieping ?? {};
  const fouten: string[] = [];
  const feiten = new Map<string, Feit>();
  const vragen: OpenVraag[] = [];

  for (const id of Object.keys(antwoorden)) {
    if (!regelset.gegevens.some((g) => g.id === id)) fouten.push(`onbekende vraag "${id}"`);
  }

  // Feit uit de Data-check: persoonsgegevens ja / nee / onzeker (één feit voor Toolbox en DPIA).
  const data = gekozen(invoer, "data");
  if (data.length > 0) {
    const waarde = data.includes("persoonsgegevens") ? "ja" : data.includes("weet_niet") ? "onzeker" : "nee";
    feiten.set("persoonsgegevens", {
      id: "persoonsgegevens",
      waarde,
      bron: "check.data",
      herkomst: "expliciet",
      zekerheid: "zeker",
      gebruiktDoor: GEBRUIKT_DOOR.persoonsgegevens!,
      toelichting: `beantwoord bij ${labelVan(regelset, "data", data)}`,
    });
  }

  const ctx: Context = {
    invoer,
    regelset,
    autonomie: gekozen(invoer, "autonomie"),
    systemen: gekozen(invoer, "systemen"),
    gebruikers: gekozen(invoer, "gebruikers"),
    afhankelijkheid: gekozen(invoer, "afhankelijkheid"),
    impact: gekozen(invoer, "impact"),
    waarde: (id) => feiten.get(id)?.waarde,
  };

  // Bijzondere persoonsgegevens: de bestaande extra vraag bij Data (niet opnieuw vragen).
  const bijzonder = invoer.extraVragen?.bijzondere_persoonsgegevens;
  if (dpiaActief(ctx) && (typeof bijzonder === "boolean" || bijzonder === "onzeker")) {
    feiten.set("bijzondere_persoonsgegevens", {
      id: "bijzondere_persoonsgegevens",
      waarde: bijzonder === "onzeker" ? "weet_niet" : bijzonder ? "ja" : "nee",
      bron: "extra_vraag.bijzondere_persoonsgegevens",
      herkomst: "expliciet",
      zekerheid: "zeker",
      gebruiktDoor: GEBRUIKT_DOOR.bijzondere_persoonsgegevens!,
      toelichting: "beantwoord bij Data (bijzondere persoonsgegevens)",
    });
  }

  // De gegevens in de volgorde van de regelset; latere regels kunnen eerdere feiten gebruiken.
  for (const g of regelset.gegevens) {
    const regel = REGELS[g.id];
    if (!regel.relevant(ctx)) continue;
    const afgeleid = regel.afleiden?.(ctx);
    if (afgeleid) {
      feiten.set(g.id, { id: g.id, ...afgeleid, herkomst: "afgeleid", zekerheid: "deterministisch", gebruiktDoor: gebruiktDoor(g) });
      continue;
    }
    const a = antwoorden[g.id];
    const geldig = a !== undefined && g.antwoorden.some((x) => x.id === a);
    if (a !== undefined && !geldig) fouten.push(`ongeldig antwoord "${a}" bij vraag "${g.id}"`);
    vragen.push({ gegeven: g, signaal: regel.signaal?.(ctx) ?? false, antwoord: geldig ? a : undefined });
    if (geldig) {
      const label = g.antwoorden.find((x) => x.id === a)!.label;
      feiten.set(g.id, {
        id: g.id,
        waarde: a,
        bron: `verdieping.${g.id}`,
        herkomst: "expliciet",
        zekerheid: "zeker",
        gebruiktDoor: gebruiktDoor(g),
        toelichting: `beantwoord: ${label}`,
      });
    }
  }

  // Feiten uit de checks zelf, met de beoordelingen die ze voeden (scenario 10: één antwoord, drie beoordelingen).
  const checkFeiten: Feit[] = [];
  for (const c of regelset.checks) {
    const ids = gekozen(invoer, c.id);
    if (ids.length === 0) continue;
    const door = new Set<Beoordeling>(["toolbox"]);
    for (const f of feiten.values()) if (f.bron === `check.${c.id}`) for (const b of f.gebruiktDoor) door.add(b);
    if (c.id === "data") door.add("dpia");
    checkFeiten.push({
      id: `check.${c.id}`,
      waarde: [...new Set(ids)].join(","),
      bron: `check.${c.id}`,
      herkomst: "expliciet",
      zekerheid: "zeker",
      gebruiktDoor: [...door],
      toelichting: `beantwoord bij ${labelVan(regelset, c.id, [...new Set(ids)])}`,
    });
  }

  return { dpiaActief: dpiaActief(ctx), aiActief: aiActief(ctx), feiten: [...checkFeiten, ...feiten.values()], vragen, fouten };
}

// ---------- DPIA-telling ----------

const TELT_ALS_INDICATOR = new Set(["ja", "weet_niet", "onzeker"]);

export function evalueerDpia(analyse: VerdiepingAnalyse, regelset: Regelset): DpiaUitkomst {
  if (!analyse.dpiaActief) return { actief: false, score: 0, klasse: null, klasseNaam: null, indicatoren: [] };
  const feit = (id: string) => analyse.feiten.find((f) => f.id === id);
  const indicatoren = regelset.dpia.indicatoren.flatMap((i) => {
    const f = feit(i.id);
    return f ? [{ id: i.id, naam: i.naam, waarde: f.waarde, telt: TELT_ALS_INDICATOR.has(f.waarde), feit: f }] : [];
  });
  const score = indicatoren.filter((i) => i.telt).length;
  const klasse = [...regelset.dpia.klassen].reverse().find((k) => score >= k.vanaf)!;
  return { actief: true, score, klasse: klasse.id, klasseNaam: klasse.naam, indicatoren };
}

// ---------- AI-risico ----------

export function evalueerAi(analyse: VerdiepingAnalyse, regelset: Regelset): AiUitkomst {
  const ar = regelset.ai_risico;
  if (!analyse.aiActief) return { actief: false, klasse: null, klasseNaam: null, redenen: [], domein: null };
  const rang = new Map(ar.klassen.map((k, i) => [k.id, i]));
  let hoogste = 0;
  const redenen: AiUitkomst["redenen"] = [];
  for (const r of ar.regels) {
    const f = analyse.feiten.find((x) => x.id === r.gegeven);
    if (!f || f.waarde !== r.antwoord) continue;
    const g = regelset.gegevens.find((x) => x.id === r.gegeven)!;
    redenen.push({
      gegeven: r.gegeven,
      naam: g.naam,
      antwoord: r.antwoord,
      antwoordLabel: g.antwoorden.find((a) => a.id === r.antwoord)?.label ?? r.antwoord,
      klasse: r.klasse,
      ...(r.voorwaarde ? { voorwaarde: r.voorwaarde } : {}),
      feit: f,
    });
    // De klasse kan alleen omhoog: een later antwoord verlaagt nooit een eerder hoger risico.
    hoogste = Math.max(hoogste, rang.get(r.klasse)!);
  }
  const klasse = ar.klassen[hoogste]!;
  return {
    actief: true,
    klasse: klasse.id,
    klasseNaam: klasse.naam,
    // Alleen de redenen die de klasse bepaalden, eerst de zwaarste.
    redenen: redenen.filter((r) => r.klasse === klasse.id),
    domein: analyse.feiten.find((f) => f.id === "ai_domein")?.waarde ?? null,
  };
}

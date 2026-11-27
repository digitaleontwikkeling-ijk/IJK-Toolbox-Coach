/**
 * Adviesregels voor het tooladvies (fase 1): welke tool, of welke hoofdtool met aanvullende tools, past functioneel
 * bij een use case. Ze bepalen NIET of de use case mag: dat doen de checks en beslisregels in fase 2.
 *
 * De standaardregels staan in content/adviesregels.yaml (met versienummer). Een beheerder kan in het beheerscherm
 * regels wijzigen, toevoegen, (de)activeren en verwijderen; die wijzigingen staan in de database, net als de
 * mailsjablonen. Geen rij = de standaard. Pure functies: samenvoegen, valideren en de mutaties zelf, zodat de server
 * en de statische demo precies dezelfde regels gebruiken.
 *
 * Veiligheid: een regel is beheerde configuratie, geen instructie aan het taalmodel. Regels hebben een vaste
 * structuur, maximale lengtes en worden geweigerd als ze op technische instructies of geheimen lijken. In de prompt
 * staan ze als gegevens (JSON) onder de vaste instructies; zie src/coach/prompts.ts.
 */
import { z } from "zod";

export const ALGEMEEN = "algemeen";

export const SOORTEN = ["beschrijving", "toepassing", "voorkeur", "uitsluiting", "combinatie", "algemeen", "voorwaarde", "voorbeeld"] as const;
export type Soort = (typeof SOORTEN)[number];

/** Soorten die bij één tool horen (niet bij "algemeen"). */
export const SOORTEN_PER_TOOL: readonly Soort[] = ["beschrijving", "toepassing", "voorkeur", "combinatie"];

export const MAX = { titel: 100, tekst: 1200, trefwoord: 40, trefwoorden: 30, regels: 200 } as const;

/**
 * Tekst die op een technische instructie, een poging tot promptinjectie of een geheim lijkt. Een adviesregel gaat
 * over tools en hun inzet, niet over de werking van de coach of de app.
 */
const VERBODEN: { patroon: RegExp; reden: string }[] = [
  { patroon: /\b(negeer|vergeet|overschrijf|omzeil|ignore|disregard|forget|override|bypass)\b/i, reden: "instructies om regels te negeren of te omzeilen" },
  { patroon: /\b(systeem ?prompt|system ?prompt|systeeminstructie|developer ?message|jailbreak|prompt)\b/i, reden: "verwijzingen naar de prompt of systeeminstructies" },
  { patroon: /\b(api[-_ ]?key|apikey|secret|wachtwoord|password|bearer|private key|credential)/i, reden: "geheimen, sleutels of wachtwoorden" },
  { patroon: /\b(autorisatie|authenticatie|inlog|rol(len)?|beheerder|toetser|audit)\w*\s+(uit|uitschakelen|overslaan|weg)/i, reden: "beveiliging of autorisatie" },
  { patroon: /\b(kleur|uitkomst|groen|geel|oranje|rood)\b.{0,30}\b(is|wordt|altijd|geef|kies)\b/i, reden: "de uitkomst of kleur (die berekent de app met vaste beslisregels)" },
  { patroon: /\b(goedgekeurd|toegestaan)\s+voor\s+(elke|iedere|alle|deze)\s+use ?case|zonder\s+(toetsing|toetsen|checks)/i, reden: "een tool zonder toetsing als goedgekeurd presenteren" },
  { patroon: /<\/?[a-z][^>]*>|```|\{\{|\}\}|\$\{|<\|/i, reden: "opmaak- of codeblokken" },
  { patroon: /https?:\/\/|www\./i, reden: "links" },
  { patroon: /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/, reden: "onzichtbare of besturingstekens" },
];

/** Geeft de reden als een tekst niet als adviesregel mag, anders null. */
export function verbodenInhoud(tekst: string): string | null {
  for (const v of VERBODEN) if (v.patroon.test(tekst)) return v.reden;
  return null;
}

const schoneTekst = (max: number, veld: string) =>
  z
    .string({ required_error: `Vul ${veld} in.` })
    .transform((s) => s.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim())
    .pipe(
      z
        .string()
        .min(1, `Vul ${veld} in.`)
        .max(max, `${veld[0]!.toUpperCase()}${veld.slice(1)} mag maximaal ${max} tekens zijn.`)
        .superRefine((s, ctx) => {
          const r = verbodenInhoud(s);
          if (r) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${veld[0]!.toUpperCase()}${veld.slice(1)} bevat ${r}. Dat hoort niet in een adviesregel.` });
        }),
    );

const toolId = z.string().regex(/^[a-z0-9_]+$/, "Ongeldige tool.").max(64);

export const adviesregelSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]{3,60}$/, "De sleutel bestaat uit 3 tot 60 kleine letters, cijfers of _."),
    titel: schoneTekst(MAX.titel, "de titel"),
    soort: z.enum(SOORTEN, { errorMap: () => ({ message: "Kies een geldige soort regel." }) }),
    /** Toepassingsgebied: een tool uit de toolbox, of "algemeen". */
    tool: toolId,
    tekst: schoneTekst(MAX.tekst, "de tekst"),
    actief: z.boolean().default(true),
    /** 1 = zwaarst. Bij tegenstrijdige voorkeuren wint de laagste prioriteit; ook de volgorde in de prompt. */
    prioriteit: z.number({ invalid_type_error: "De prioriteit is een geheel getal van 1 tot 999." }).int("De prioriteit is een geheel getal van 1 tot 999.").min(1, "De prioriteit is een geheel getal van 1 tot 999.").max(999, "De prioriteit is een geheel getal van 1 tot 999.").default(100),
    /** Signaalwoorden voor de oefencoach (zonder AI); het taalmodel leest de tekst. */
    trefwoorden: z
      .array(z.string().trim().toLowerCase().min(2, "Een trefwoord heeft minstens 2 tekens.").max(MAX.trefwoord, `Een trefwoord heeft maximaal ${MAX.trefwoord} tekens.`).regex(/^[\p{L}\p{N} '’-]+$/u, "Een trefwoord bestaat uit letters, cijfers, spaties of -."))
      .max(MAX.trefwoorden, `Maximaal ${MAX.trefwoorden} trefwoorden.`)
      .default([]),
    /** Voorkeur: deze tool gaat vóór deze tools. */
    boven: z.array(toolId).max(10).default([]),
    /** Combinatie: deze tool komt als aanvullende tool bij deze hoofdtools. */
    bij: z.array(toolId).max(10).default([]),
    /** Uitsluiting: deze tool nooit als hoofdtool adviseren (wel als aanvullende tool). */
    nooit_hoofdtool: z.boolean().default(false),
  })
  .strict();
export type Adviesregel = z.output<typeof adviesregelSchema>;
export type AdviesregelInvoer = z.input<typeof adviesregelSchema>;

export const adviesregelsBestandSchema = z.object({
  versie: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
  regels: z.array(adviesregelSchema).min(1).max(MAX.regels),
});
export type AdviesregelsBestand = z.output<typeof adviesregelsBestandSchema>;

/** Wat de database per regel bewaart: een eigen versie, of "verwijderd" (alleen bij een standaardregel). */
export interface Opgeslagen {
  regel: Adviesregel | null;
  verwijderd: boolean;
  bijgewerktOp?: string;
  bijgewerktDoor?: string;
}

export type RegelStatus = "standaard" | "aangepast" | "nieuw";
export interface RegelMetStatus extends Adviesregel {
  status: RegelStatus;
  bijgewerktOp?: string;
}

export interface Historie {
  nr: number;
  regelId: string;
  vorige: Adviesregel | null;
  nieuwe: Adviesregel | null;
  gewijzigdOp: string;
}

export interface ToolInfo {
  id: string;
  naam: string;
}

/** Volgorde: toepassingsgebied (algemeen eerst, dan tools in de volgorde van tools.yaml), prioriteit, soort, titel. */
export function sorteer<T extends Adviesregel>(regels: T[], tools: ToolInfo[]): T[] {
  const plek = (t: string) => (t === ALGEMEEN ? -1 : tools.findIndex((x) => x.id === t));
  return [...regels].sort(
    (a, b) => plek(a.tool) - plek(b.tool) || a.prioriteit - b.prioriteit || SOORTEN.indexOf(a.soort) - SOORTEN.indexOf(b.soort) || a.titel.localeCompare(b.titel, "nl"),
  );
}

/**
 * De regels die gelden: de standaard, met de opgeslagen wijzigingen erover. Een opgeslagen regel die niet (meer)
 * geldig is, wordt overgeslagen; dan geldt de standaard.
 */
export function samenvoegen(standaard: Adviesregel[], opgeslagen: Record<string, Opgeslagen>, tools: ToolInfo[]): { regels: RegelMetStatus[]; verwijderdeStandaard: Adviesregel[]; overgeslagen: string[] } {
  const overgeslagen: string[] = [];
  const regels: RegelMetStatus[] = [];
  const verwijderdeStandaard: Adviesregel[] = [];
  const standaardIds = new Set(standaard.map((r) => r.id));
  for (const s of standaard) {
    const o = opgeslagen[s.id];
    if (o?.verwijderd) {
      verwijderdeStandaard.push(s);
      continue;
    }
    const geldig = o?.regel ? adviesregelSchema.safeParse(o.regel) : null;
    if (o?.regel && !geldig?.success) overgeslagen.push(s.id);
    regels.push(geldig?.success ? { ...geldig.data, id: s.id, status: "aangepast", bijgewerktOp: o!.bijgewerktOp } : { ...s, status: "standaard" });
  }
  for (const [id, o] of Object.entries(opgeslagen)) {
    if (standaardIds.has(id) || !o.regel || o.verwijderd) continue;
    const geldig = adviesregelSchema.safeParse(o.regel);
    if (!geldig.success) {
      overgeslagen.push(id);
      continue;
    }
    regels.push({ ...geldig.data, id, status: "nieuw", bijgewerktOp: o.bijgewerktOp });
  }
  return { regels: sorteer(regels, tools), verwijderdeStandaard: sorteer(verwijderdeStandaard, tools), overgeslagen };
}

export interface Controle {
  fouten: string[];
  waarschuwingen: string[];
}

const normaliseer = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Controleert de hele set regels: wat niet mag, wordt een fout (dan wordt niets opgeslagen en blijven de oude
 * regels actief). Wat mag maar aandacht vraagt, wordt een waarschuwing.
 */
export function controleer(regels: Adviesregel[], tools: ToolInfo[]): Controle {
  const fouten: string[] = [];
  const waarschuwingen: string[] = [];
  const toolIds = new Set(tools.map((t) => t.id));
  const naam = (id: string) => (id === ALGEMEEN ? "Algemeen" : tools.find((t) => t.id === id)?.naam ?? id);
  const titel = (r: Adviesregel) => `‘${r.titel}’ (${naam(r.tool)})`;

  if (regels.length > MAX.regels) fouten.push(`Er mogen maximaal ${MAX.regels} regels zijn.`);
  const ids = new Set<string>();
  for (const r of regels) {
    if (ids.has(r.id)) fouten.push(`De sleutel ${r.id} komt twee keer voor.`);
    ids.add(r.id);
    if (r.tool !== ALGEMEEN && !toolIds.has(r.tool)) fouten.push(`${titel(r)}: de tool staat niet in de IJK Toolbox.`);
    const perTool = SOORTEN_PER_TOOL.includes(r.soort);
    if (perTool && r.tool === ALGEMEEN) fouten.push(`${titel(r)}: een regel van de soort ‘${r.soort}’ hoort bij één tool, niet bij Algemeen.`);
    if (r.soort === "voorkeur" && r.boven.length === 0) fouten.push(`${titel(r)}: kies bij een voorkeur boven welke tool(s) deze tool gaat.`);
    if (r.soort === "combinatie" && r.bij.length === 0) fouten.push(`${titel(r)}: kies bij een combinatie bij welke hoofdtool(s) deze tool hoort.`);
    for (const t of [...r.boven, ...r.bij]) {
      if (!toolIds.has(t)) fouten.push(`${titel(r)}: ‘${t}’ staat niet in de IJK Toolbox.`);
      if (t === r.tool) fouten.push(`${titel(r)}: een tool kan niet naar zichzelf verwijzen.`);
    }
    if (r.soort !== "voorkeur" && r.boven.length) fouten.push(`${titel(r)}: ‘gaat vóór’ hoort alleen bij een voorkeur.`);
    if (r.soort !== "combinatie" && r.bij.length) fouten.push(`${titel(r)}: ‘aanvullend bij’ hoort alleen bij een combinatie.`);
    if (r.nooit_hoofdtool && r.tool === ALGEMEEN) fouten.push(`${titel(r)}: ‘nooit als hoofdtool’ kan alleen bij een tool uit de toolbox.`);
    if (r.soort !== "uitsluiting" && r.nooit_hoofdtool) fouten.push(`${titel(r)}: ‘nooit als hoofdtool’ hoort alleen bij een uitsluiting.`);
  }

  const actief = regels.filter((r) => r.actief);
  // Dubbele actieve regels: dezelfde tekst binnen hetzelfde toepassingsgebied.
  const teksten = new Map<string, Adviesregel>();
  for (const r of actief) {
    const sleutel = `${r.tool}|${normaliseer(r.tekst)}`;
    const eerder = teksten.get(sleutel);
    if (eerder) fouten.push(`${titel(r)} heeft dezelfde tekst als ${titel(eerder)}. Pas er één aan of zet er één op inactief.`);
    else teksten.set(sleutel, r);
  }
  // Eén beschrijving per tool, anders kunnen ze elkaar tegenspreken.
  for (const t of tools) {
    const b = actief.filter((r) => r.tool === t.id && r.soort === "beschrijving");
    if (b.length > 1) fouten.push(`${t.naam} heeft ${b.length} actieve beschrijvingen. Houd er één actief.`);
  }
  // Tegenstrijdige voorkeuren: A vóór B én B vóór A.
  const voorkeuren = actief.filter((r) => r.soort === "voorkeur");
  for (const a of voorkeuren) {
    for (const b of voorkeuren) {
      if (a.id >= b.id || !a.boven.includes(b.tool) || !b.boven.includes(a.tool)) continue;
      // Met een verschillende prioriteit is het veilig op te lossen (de laagste wint); met dezelfde niet.
      if (a.prioriteit === b.prioriteit) {
        fouten.push(`${titel(a)} en ${titel(b)} spreken elkaar tegen en hebben dezelfde prioriteit (${a.prioriteit}). Geef ze een verschillende prioriteit: de laagste wint.`);
      }
    }
  }
  // Een combinatie bij een tool die nooit hoofdtool is, wordt nooit gebruikt.
  const nooit = new Set(actief.filter((r) => r.soort === "uitsluiting" && r.nooit_hoofdtool).map((r) => r.tool));
  for (const r of actief.filter((x) => x.soort === "combinatie")) {
    if (r.bij.every((t) => nooit.has(t))) waarschuwingen.push(`${titel(r)} wordt nooit gebruikt: de hoofdtool(s) waarbij hij hoort, worden nooit als hoofdtool geadviseerd.`);
  }
  if (tools.length && tools.every((t) => nooit.has(t.id))) fouten.push("Elke tool staat op ‘nooit als hoofdtool’. Dan kan de coach geen advies meer geven.");
  for (const t of tools) {
    if (!actief.some((r) => r.tool === t.id && (r.soort === "beschrijving" || r.soort === "toepassing"))) {
      waarschuwingen.push(`${t.naam} heeft geen actieve beschrijving of toepassingen. De coach weet dan weinig over deze tool.`);
    }
  }
  return { fouten: [...new Set(fouten)], waarschuwingen: [...new Set(waarschuwingen)] };
}

/** De actieve regels, gesorteerd. */
export function actieveRegels<T extends Adviesregel>(regels: T[]): T[] {
  return regels.filter((r) => r.actief);
}

/** Tools die volgens de actieve regels nooit hoofdtool zijn (worden in de validatie van het tooladvies uitgesloten). */
export function nooitHoofdtool(regels: Adviesregel[]): string[] {
  return [...new Set(actieveRegels(regels).filter((r) => r.soort === "uitsluiting" && r.nooit_hoofdtool).map((r) => r.tool))];
}

/** Versie van de regels die gold: de versie van adviesregels.yaml plus het aantal beheerwijzigingen (b<n>). */
export function regelsVersie(standaardVersie: string, laatsteWijziging: number): string {
  return laatsteWijziging > 0 ? `${standaardVersie}+b${laatsteWijziging}` : standaardVersie;
}

// ---------- Mutaties (zelfde logica op de server en in de demo) ----------

export class RegelFout extends Error {
  constructor(message: string, public readonly details: string[] = []) {
    super(message);
  }
}

export type Mutatie =
  | { actie: "toevoegen"; regel: AdviesregelInvoer }
  | { actie: "wijzigen"; regel: AdviesregelInvoer }
  | { actie: "verwijderen"; id: string }
  | { actie: "standaard"; id: string }
  | { actie: "terugzetten"; historie: Historie };

export interface MutatieResultaat {
  id: string;
  /** Wat er in de database komt; null = de rij verwijderen (dan geldt de standaard, of de regel bestaat niet meer). */
  opslaan: Opgeslagen | null;
  vorige: Adviesregel | null;
  nieuwe: Adviesregel | null;
  waarschuwingen: string[];
}

function parse(invoer: unknown): Adviesregel {
  const r = adviesregelSchema.safeParse(invoer);
  if (!r.success) throw new RegelFout("De regel is niet opgeslagen. Controleer de velden.", [...new Set(r.error.issues.map((i) => i.message))]);
  return r.data;
}

/**
 * Past één wijziging toe en controleert daarna de héle set. Bij een fout wordt niets opgeslagen (RegelFout) en
 * blijven de huidige regels actief.
 */
export function pasToe(standaard: Adviesregel[], opgeslagen: Record<string, Opgeslagen>, tools: ToolInfo[], m: Mutatie): MutatieResultaat {
  const huidig = samenvoegen(standaard, opgeslagen, tools);
  const isStandaard = (id: string) => standaard.find((s) => s.id === id);
  const bestaand = (id: string) => huidig.regels.find((r) => r.id === id);
  let id: string;
  let nieuwe: Adviesregel | null;
  let opslaan: Opgeslagen | null;

  switch (m.actie) {
    case "toevoegen": {
      nieuwe = parse(m.regel);
      id = nieuwe.id;
      if (bestaand(id) || isStandaard(id)) throw new RegelFout(`Er is al een regel met de sleutel ${id}. Kies een andere sleutel.`);
      opslaan = { regel: nieuwe, verwijderd: false };
      break;
    }
    case "wijzigen": {
      nieuwe = parse(m.regel);
      id = nieuwe.id;
      if (!bestaand(id)) throw new RegelFout("Deze regel bestaat niet (meer). Laad de pagina opnieuw.");
      const s = isStandaard(id);
      // Gelijk aan de standaard: geen eigen versie bewaren.
      opslaan = s && JSON.stringify(s) === JSON.stringify(nieuwe) ? null : { regel: nieuwe, verwijderd: false };
      break;
    }
    case "verwijderen": {
      id = m.id;
      if (!bestaand(id)) throw new RegelFout("Deze regel bestaat niet (meer). Laad de pagina opnieuw.");
      nieuwe = null;
      opslaan = isStandaard(id) ? { regel: null, verwijderd: true } : null;
      break;
    }
    case "standaard": {
      id = m.id;
      const s = isStandaard(id);
      if (!s) throw new RegelFout("Voor deze regel is geen standaard.");
      nieuwe = s;
      opslaan = null;
      break;
    }
    case "terugzetten": {
      id = m.historie.regelId;
      const terug = m.historie.vorige ? parse(m.historie.vorige) : null;
      nieuwe = terug;
      const s = isStandaard(id);
      if (terug === null) opslaan = s ? { regel: null, verwijderd: true } : null;
      else opslaan = s && JSON.stringify(s) === JSON.stringify(terug) ? null : { regel: terug, verwijderd: false };
      break;
    }
  }

  const volgende = { ...opgeslagen };
  if (opslaan) volgende[id] = opslaan;
  else delete volgende[id];
  const na = samenvoegen(standaard, volgende, tools);
  const c = controleer(na.regels, tools);
  if (c.fouten.length) throw new RegelFout("De wijziging is niet opgeslagen: de regels zouden niet meer kloppen. De huidige regels blijven actief.", c.fouten);
  const vorige = bestaand(id) ?? null;
  return { id, opslaan, vorige: vorige ? zonderStatus(vorige) : null, nieuwe, waarschuwingen: c.waarschuwingen };
}

export function zonderStatus(r: RegelMetStatus | Adviesregel): Adviesregel {
  const { status: _s, bijgewerktOp: _b, ...rest } = r as RegelMetStatus;
  return rest;
}

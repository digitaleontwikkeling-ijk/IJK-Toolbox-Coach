/**
 * Schema's voor de content-bestanden in `content/`.
 *
 * Naast de vorm van de bestanden controleren we ook de onderlinge verwijzingen
 * (bestaat een genoemde kleur, toetser of check?), zodat een fout in de YAML
 * bij het opstarten opvalt en niet pas bij een advies.
 */
import { z } from "zod";

const id = z.string().regex(/^[a-z0-9_]+$/, "gebruik alleen kleine letters, cijfers en _");
const tekst = z.string().trim().min(1);
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "verwacht een hexkleur zoals #50A78A");

export const VERVOLGACTIES = [
  "accountaanvraag",
  "accountaanvraag_met_voorwaarden",
  "toetsing",
  "alleen_vastleggen",
] as const;

const kleurSchema = z.object({
  id,
  uitkomst: tekst,
  hex,
  tekstkleur: hex,
  vervolgactie: z.enum(VERVOLGACTIES),
  /** Welke toetsers horen bij deze uitkomst: geen, per oranje check, of alle toetsers samen. */
  toetsers: z.enum(["geen", "per_check", "alle"]).default("geen"),
  /** Geen alternatief bij deze uitkomst? Dan neemt Team Digitale Ontwikkeling contact op. */
  contact_als_geen_alternatief: z.boolean().default(false),
  motivatie: tekst,
});

const antwoordSchema = z.object({
  id,
  label: tekst,
  /** Korte naam voor "Waarom deze kleur?" (standaard het label). */
  kort: tekst.optional(),
  /** Toelichting achter het "i"-knopje bij deze keuze. */
  uitleg: tekst.optional(),
  kleur: id,
  voorwaarde: tekst.optional(),
  alternatief: tekst.optional(),
  /** Wat je extra moet regelen bij dit antwoord. */
  extra_regelen: tekst.optional(),
});

const hulpSchema = z.array(z.object({ kop: tekst.optional(), tekst })).default([]);

const deelvraagSchema = z.object({
  id,
  naam: tekst,
  vraag: tekst,
  /** Voorbeeld per antwoord-id. Alleen voor de coach; niet zichtbaar in de wizard. */
  voorbeelden: z.record(id, tekst).default({}),
});

const checkSchema = z.object({
  id,
  nummer: z.number().int().positive(),
  naam: tekst,
  vraag: tekst,
  toetser: id,
  /** Mag de medewerker meerdere antwoorden kiezen? De hoogste kleur telt. */
  meerdere: z.boolean().default(false),
  hulp: hulpSchema,
  antwoorden: z.array(antwoordSchema).min(1),
  /** Deelvragen met dezelfde schaal (bijvoorbeeld Impact: B, I, V). De hoogste kleur telt. */
  deelvragen: z.array(deelvraagSchema).default([]),
});

const extraVraagSchema = z.object({
  id,
  check: id,
  toon_bij: z.array(id).min(1),
  vraag: tekst,
  uitleg: tekst.optional(),
  /** Mag de medewerker "Weet ik niet zeker" antwoorden? (telt bij de privacy-telling als indicator) */
  onzeker_mogelijk: z.boolean().default(false),
});

const rodeVlagSchema = z.object({
  id,
  nummer: z.number().int().positive(),
  /** Alleen stellen bij deze antwoorden op een check; anders is het antwoord "nee". */
  toon_bij: z.object({ check: id, antwoorden: z.array(id).min(1) }).optional(),
  vraag: tekst,
  uitleg: tekst.optional(),
  kort: tekst,
  alternatief: tekst.optional(),
});

/**
 * De gegevens die de verdieping (privacy en AI) kent. De afleidingen uit de checks staan in
 * `verdieping.ts`; de vragen en teksten in de regelset. Beide moeten precies deze id's kennen.
 */
export const GEGEVEN_IDS = [
  "ai_gebruik",
  "kwetsbare_groepen",
  "koppeling_datasets",
  "grote_schaal",
  "profilering",
  "geautomatiseerd_besluit",
  "significante_gevolgen",
  "ai_invloed",
  "ai_doorslaggevend",
  "ai_domein",
  "ai_discriminatie",
  "ai_herziening",
  "ai_transparantie",
  "ai_toezicht",
  "ai_uitlegbaarheid",
] as const;
export type GegevenId = (typeof GEGEVEN_IDS)[number];
/** DPIA-indicatoren kunnen ook uit de extra vraag over bijzondere persoonsgegevens komen. */
export const DPIA_BRONNEN = [...GEGEVEN_IDS, "bijzondere_persoonsgegevens"] as const;

const gegevenSchema = z.object({
  id: z.enum(GEGEVEN_IDS),
  spoor: z.enum(["basis", "dpia", "ai"]),
  /** Onder welke check de vraag verschijnt. */
  plek: id,
  naam: tekst,
  vraag: tekst,
  /** Waarom vragen we dit? (korte zin onder de vraag) */
  uitleg: tekst,
  /** Inleiding als er al gedeeltelijke informatie is (de vraag wordt dan een verduidelijking). */
  signaal: tekst.optional(),
  antwoorden: z.array(z.object({ id, label: tekst })).min(2),
});
export type Gegeven = z.infer<typeof gegevenSchema>;

const klasseMetMinimum = z.object({ id, naam: tekst, minimale_uitkomst: id.optional() });

export const regelsetSchema = z
  .object({
    versie: tekst,
    gevalideerd: z.boolean(),
    kleuren: z.array(kleurSchema).min(1),
    toetsers: z.array(z.object({ id, naam: tekst })).min(1),
    checks: z.array(checkSchema).min(1),
    extra_vragen: z.array(extraVraagSchema).default([]),
    rode_vlag_kleur: id,
    rode_vlaggen: z.array(rodeVlagSchema).default([]),
    /** Verdieping: vragen voor privacy (pre-DPIA) en AI-risico. */
    gegevens: z.array(gegevenSchema),
    dpia: z.object({
      toetser: id,
      indicatoren: z.array(z.object({ id: z.enum(DPIA_BRONNEN), naam: tekst })).length(8),
      /** Oplopend op "vanaf"; de eerste begint bij 0. */
      klassen: z.array(klasseMetMinimum.extend({ vanaf: z.number().int().min(0) })).min(1),
      motivatie: tekst,
    }),
    ai_risico: z.object({
      toetser: id,
      /** Van laag naar hoog. */
      klassen: z.array(klasseMetMinimum).min(1),
      regels: z.array(z.object({ gegeven: z.enum(GEGEVEN_IDS), antwoord: id, klasse: id, voorwaarde: tekst.optional() })),
      motivatie: tekst,
    }),
    /** "Weet ik niet zeker" bij een aanvullende vraag: minstens deze kleur, met deze toetsers. */
    rode_vlag_onzeker: z.object({ minimale_uitkomst: id, toetsers: z.array(id).min(1), motivatie: tekst }),
    /** Een tool buiten de IJK Toolbox: minstens deze kleur en altijd deze toetsers. */
    tool_buiten_toolbox: z.object({
      minimale_uitkomst: id,
      toetsers: z.array(id).min(1),
      motivatie: tekst,
    }),
    motivatie_rode_vlag: tekst,
  })
  .superRefine((r, ctx) => {
    const fout = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const kleurIds = new Set(r.kleuren.map((k) => k.id));
    const toetserIds = new Set(r.toetsers.map((t) => t.id));
    const checkById = new Map(r.checks.map((c) => [c.id, c]));
    const extraIds = new Set(r.extra_vragen.map((e) => e.id));
    const vlagIds = new Set(r.rode_vlaggen.map((v) => v.id));

    dubbel(r.kleuren.map((k) => k.id), "kleur", fout);
    dubbel(r.checks.map((c) => c.id), "check", fout);
    dubbel(r.rode_vlaggen.map((v) => v.id), "rode vlag", fout);
    dubbel(r.extra_vragen.map((e) => e.id), "extra vraag", fout);

    if (!kleurIds.has(r.rode_vlag_kleur)) fout(`rode_vlag_kleur: onbekende kleur "${r.rode_vlag_kleur}"`);

    for (const c of r.checks) {
      if (!toetserIds.has(c.toetser)) fout(`check ${c.id}: onbekende toetser "${c.toetser}"`);
      dubbel(c.antwoorden.map((a) => a.id), `antwoord in check ${c.id}`, fout);
      for (const a of c.antwoorden) {
        if (!kleurIds.has(a.kleur)) fout(`check ${c.id}, antwoord ${a.id}: onbekende kleur "${a.kleur}"`);
      }
      if (c.deelvragen.length && c.meerdere) fout(`check ${c.id}: deelvragen en meerdere antwoorden gaan niet samen`);
      dubbel(c.deelvragen.map((d) => d.id), `deelvraag in check ${c.id}`, fout);
      for (const d of c.deelvragen) {
        for (const a of Object.keys(d.voorbeelden)) {
          if (!c.antwoorden.some((x) => x.id === a)) fout(`check ${c.id}, deelvraag ${d.id}: onbekend antwoord "${a}"`);
        }
      }
    }

    for (const e of r.extra_vragen) {
      const c = checkById.get(e.check);
      if (!c) fout(`extra vraag ${e.id}: onbekende check "${e.check}"`);
      else for (const a of e.toon_bij) {
        if (!c.antwoorden.some((x) => x.id === a)) fout(`extra vraag ${e.id}: onbekend antwoord "${a}"`);
      }
    }

    for (const v of r.rode_vlaggen) {
      if (!v.toon_bij) continue;
      const c = checkById.get(v.toon_bij.check);
      if (!c) fout(`rode vlag ${v.id}: onbekende check "${v.toon_bij.check}"`);
      else for (const a of v.toon_bij.antwoorden) {
        if (!c.antwoorden.some((x) => x.id === a)) fout(`rode vlag ${v.id}: onbekend antwoord "${a}"`);
      }
    }

    // Verdieping
    dubbel(r.gegevens.map((g) => g.id), "gegeven", fout);
    for (const g of GEGEVEN_IDS) if (!r.gegevens.some((x) => x.id === g)) fout(`gegevens: "${g}" ontbreekt`);
    for (const g of r.gegevens) {
      if (!checkById.has(g.plek)) fout(`gegeven ${g.id}: onbekende plek (check) "${g.plek}"`);
      dubbel(g.antwoorden.map((a) => a.id), `antwoord bij gegeven ${g.id}`, fout);
    }
    const antwoordBestaat = (gegeven: string, antwoord: string) =>
      r.gegevens.find((g) => g.id === gegeven)?.antwoorden.some((a) => a.id === antwoord) ?? false;
    if (!toetserIds.has(r.dpia.toetser)) fout(`dpia: onbekende toetser "${r.dpia.toetser}"`);
    dubbel(r.dpia.indicatoren.map((i) => i.id), "DPIA-indicator", fout);
    if (r.dpia.klassen[0]?.vanaf !== 0) fout("dpia: de eerste klasse moet vanaf 0 gelden");
    for (let i = 1; i < r.dpia.klassen.length; i++) {
      if (r.dpia.klassen[i]!.vanaf <= r.dpia.klassen[i - 1]!.vanaf) fout("dpia: klassen moeten oplopen");
    }
    for (const k of [...r.dpia.klassen, ...r.ai_risico.klassen]) {
      if (k.minimale_uitkomst && !kleurIds.has(k.minimale_uitkomst)) fout(`klasse ${k.id}: onbekende kleur "${k.minimale_uitkomst}"`);
    }
    if (!toetserIds.has(r.ai_risico.toetser)) fout(`ai_risico: onbekende toetser "${r.ai_risico.toetser}"`);
    const aiKlassen = new Set(r.ai_risico.klassen.map((k) => k.id));
    for (const regel of r.ai_risico.regels) {
      if (!aiKlassen.has(regel.klasse)) fout(`ai_risico: onbekende klasse "${regel.klasse}"`);
      if (!antwoordBestaat(regel.gegeven, regel.antwoord)) fout(`ai_risico: onbekend antwoord "${regel.antwoord}" bij ${regel.gegeven}`);
    }
    if (!kleurIds.has(r.rode_vlag_onzeker.minimale_uitkomst)) {
      fout(`rode_vlag_onzeker: onbekende kleur "${r.rode_vlag_onzeker.minimale_uitkomst}"`);
    }
    for (const t of r.rode_vlag_onzeker.toetsers) {
      if (!toetserIds.has(t)) fout(`rode_vlag_onzeker: onbekende toetser "${t}"`);
    }
    if (!kleurIds.has(r.tool_buiten_toolbox.minimale_uitkomst)) {
      fout(`tool_buiten_toolbox: onbekende kleur "${r.tool_buiten_toolbox.minimale_uitkomst}"`);
    }
    for (const t of r.tool_buiten_toolbox.toetsers) {
      if (!toetserIds.has(t)) fout(`tool_buiten_toolbox: onbekende toetser "${t}"`);
    }
  });

function dubbel(ids: string[], wat: string, fout: (m: string) => void) {
  const gezien = new Set<string>();
  for (const i of ids) {
    if (gezien.has(i)) fout(`dubbele ${wat}: "${i}"`);
    gezien.add(i);
  }
}

export type Regelset = z.infer<typeof regelsetSchema>;
export type Kleur = Regelset["kleuren"][number];
export type Check = Regelset["checks"][number];
export type Antwoord = Check["antwoorden"][number];
export type RodeVlag = Regelset["rode_vlaggen"][number];
export type Deelvraag = Check["deelvragen"][number];
export type Vervolgactie = (typeof VERVOLGACTIES)[number];

export const spelregelsSchema = z.object({
  tool: id,
  zelf_doen: z.array(tekst).min(1),
  eerst_toetsen: z.array(tekst).min(1),
  altijd: z.array(tekst).min(1),
});
export type Spelregels = z.infer<typeof spelregelsSchema>;

/** Gereserveerd tool-id voor "Een andere tool (nog niet in de IJK Toolbox)". */
export const ANDERE_TOOL = "andere_tool";

export const toolsSchema = z
  .object({
    versie: tekst,
    tools: z
      .array(
        z.object({
          id,
          naam: tekst,
          omschrijving: tekst.optional(),
          spelregels: tekst,
          /**
           * Gebruikt deze tool zelf AI? Een sterk signaal: de vraag "Gebruikt je oplossing AI?" wordt dan
           * vooraf op "Ja" gezet, maar de medewerker bevestigt of past aan (het gaat om wat de oplossing doet).
           */
          ai: z.boolean().optional(),
          /** Optioneel logo, bijvoorbeeld iconen/hubbi.png (png, svg of webp, max. 200 kB). */
          icoon: z
            .string()
            .regex(/^iconen\/[a-z0-9_-]+\.(png|svg|webp)$/, "icoon: verwacht iconen/<naam>.png, .svg of .webp")
            .optional(),
        }),
      )
      .min(1),
    behoeften: z.array(z.object({ id, omschrijving: tekst, tools: z.array(id).min(1) })).min(1),
    keuzehints: z.array(tekst).default([]),
    /** Alleen voor de coach; niet zichtbaar in de wizard. */
    coach_instructies: z.array(tekst).default([]),
  })
  .superRefine((t, ctx) => {
    const toolIds = new Set(t.tools.map((x) => x.id));
    const fout = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    dubbel(t.tools.map((x) => x.id), "tool", fout);
    if (toolIds.has(ANDERE_TOOL)) fout(`tool-id "${ANDERE_TOOL}" is gereserveerd voor een tool buiten de toolbox`);
    dubbel(t.behoeften.map((x) => x.id), "behoefte", fout);
    for (const b of t.behoeften) {
      for (const tool of b.tools) if (!toolIds.has(tool)) fout(`behoefte ${b.id}: onbekende tool "${tool}"`);
    }
  });
export type ToolsConfig = z.infer<typeof toolsSchema>;

export const STATUSSEN = [
  "advies_gegeven",
  "account_aangevraagd",
  "in_toetsing",
  "goedgekeurd",
  "goedgekeurd_met_voorwaarden",
  "afgewezen",
  "contact_volgt",
] as const;
export type Status = (typeof STATUSSEN)[number];

export const tekstenSchema = z.object({
  app: z.object({ naam: tekst, uitgangspunt: tekst, testdata_melding: tekst }),
  fases: z.array(z.object({ naam: tekst, stappen: z.array(z.number().int()) })),
  stappen: z.array(z.object({ nummer: z.number().int(), titel: tekst, instructie: tekst })).length(4),
  spelregels_kopjes: z.object({ zelf_doen: tekst, eerst_toetsen: tekst, altijd: tekst }),
  vervolgacties: z.record(z.enum(VERVOLGACTIES), z.object({ knop: z.string(), uitleg: tekst })),
  statussen: z.record(z.enum(STATUSSEN), tekst),
  afronden: z.object({ knop: tekst, bevestiging: tekst }),
  onafgemaakt: z.object({ melding: tekst, knop: tekst, verwijderen: tekst, bevestig: tekst, verwijderd: tekst }),
  fase2_uitleg: z.object({
    titel: tekst,
    intro: tekst,
    hoe_titel: tekst,
    hoe: z.array(tekst).min(1),
    vragen_titel: tekst,
    vragen_intro: tekst,
    waarom_per_check: z.record(z.string(), tekst),
    aanvullend: tekst,
    daarna_titel: tekst,
    daarna_intro: tekst,
    per_vervolgactie: z.record(z.enum(VERVOLGACTIES), tekst),
    register: tekst,
    knop: tekst,
    opnieuw_lezen: tekst,
  }),
  aanvullende_vragen: z.object({ titel: tekst, intro: tekst, vraag_label: tekst, geen: tekst }),
  hoe_werkt_het: z.object({
    titel: tekst,
    link: tekst,
    intro: tekst,
    wie_titel: tekst,
    rijen: z.array(z.object({ onderdeel: tekst, wie: tekst, hoe: tekst })).min(1),
    waarom_titel: tekst,
    waarom: z.array(tekst).min(1),
    privacy_titel: tekst,
    privacy: z.array(tekst).min(1),
    zonder_ai_titel: tekst,
    zonder_ai: tekst,
    demo_melding: tekst,
    kleur_hint: tekst,
  }),
  na_actie: z.object({
    account_aangevraagd: tekst,
    in_toetsing: tekst,
    goedgekeurd: tekst,
    goedgekeurd_met_voorwaarden: tekst,
    afgewezen: tekst,
    contact_volgt: tekst,
  }),
  besluiten: z.object({ goedgekeurd: tekst, goedgekeurd_met_voorwaarden: tekst, afgewezen: tekst }),
  toetsing: z.object({
    titel: tekst,
    intro: tekst,
    toelichting_voorwaarden: tekst,
    toelichting_afwijzing: tekst,
    ter_informatie: tekst,
    ter_informatie_uitleg: tekst,
  }),
  extra_regelen_titel: tekst,
  contact_opnieuw: z.object({ melding: tekst, knop: tekst }),
  beheer: z.object({ titel: tekst, intro: tekst }),
  verdieping: z.object({
    privacy_intro: tekst,
    privacy_intro_onzeker: tekst,
    ai_titel: tekst,
    ai_intro: tekst,
    ai_intro_onzeker: tekst,
    tool_voorstel: tekst,
    voortgang: tekst,
    voortgang_een: tekst,
    voortgang_klaar: tekst,
  }),
  /** Stap 3 als gesprek: één vraag tegelijk (de lijst blijft beschikbaar). */
  gesprek: z.object({
    instructie: tekst,
    intro: tekst,
    intro_zonder_coach: tekst,
    kop_check: tekst,
    kop_aanvullend: tekst,
    voorstel: tekst,
    voorstel_onzeker: tekst,
    voorstel_tool: tekst,
    twijfel: tekst,
    al_bekend: tekst,
    wat_bedoel_je: tekst,
    chat_label: tekst,
    chat_label_klaar: tekst,
    chat_label_advies: tekst,
    chat_plaatshouder_advies: tekst,
    advies_intro: tekst,
    terugkijken: tekst,
    chat_plaatshouder: tekst,
    chat_stuur: tekst,
    denkt: tekst,
    eerdere_berichten: tekst,
    bevestig: tekst,
    volgende: tekst,
    wijzig: tekst,
    jouw_antwoord: tekst,
    klaar: tekst,
    naar_lijst: tekst,
    naar_gesprek: tekst,
    naar_formulier: tekst,
    fase1_intro: tekst,
    verduidelijking_kop_een: tekst,
    verduidelijking_kop_twee: tekst,
    zoekt_tool: tekst,
    vult_checks: tekst,
    tool_label: tekst,
    andere_tool_knop: tekst,
    niet_beschikbaar: tekst,
    fase2_hoe: z.array(tekst).min(1),
    kleur_hint: tekst,
    vervolgactie_uitleg: z.record(id, tekst).default({}),
    kop_beschrijving: tekst,
    kop_tool: tekst,
    kop_fase2: tekst,
    fase1_vraag: tekst,
    beschrijving_hulp: tekst,
    leest: tekst,
    verduidelijking_intro: tekst,
    niet_beantwoord: tekst,
    tooladvies_intro: tekst,
    tool_vraag: tekst,
  }),
  privacy: z.object({
    titel: tekst,
    niet_nodig: tekst,
    per_klasse: z.record(z.string(), tekst),
    indicatoren_titel: tekst,
    geen_indicatoren: tekst,
  }),
  ai: z.object({ titel: tekst, niet_nodig: tekst, per_klasse: z.record(z.string(), tekst), redenen_titel: tekst, feiten_titel: tekst }),
  techniek: z.object({ titel: tekst, intro: tekst, punten: z.record(z.string(), tekst) }),
  disclaimer: tekst,
  andere_tool: z.object({
    optie: tekst,
    naam_label: tekst,
    link_label: tekst,
    link_hulp: tekst,
    link_fout: tekst,
    uitleg: tekst,
    kenmerk: tekst,
  }),
  coach_niet_beschikbaar: tekst,
});
export type Teksten = z.infer<typeof tekstenSchema>;

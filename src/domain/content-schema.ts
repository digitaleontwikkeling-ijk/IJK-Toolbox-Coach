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
  /** Voorbeeld per antwoord-id, als hulptekst bij de keuzeknoppen. */
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
});

const rodeVlagSchema = z.object({
  id,
  nummer: z.number().int().positive(),
  vraag: tekst,
  uitleg: tekst.optional(),
  kort: tekst,
  alternatief: tekst.optional(),
});

const conditieSchema = z.union([
  z.object({ check: id, deelvraag: id.optional(), antwoorden: z.array(id).min(1) }).strict(),
  z.object({ extra_vraag: id }).strict(),
  z.object({ rode_vlag: id }).strict(),
]);
export type Conditie = z.infer<typeof conditieSchema>;

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
    dpia: z.object({
      vereist: z.array(conditieSchema).min(1),
      minstens_een_van: z.array(conditieSchema).min(1),
      altijd_bij: z.array(conditieSchema).default([]),
      toetser: id,
    }),
    ai_act: z.object({
      minstens_een_van: z.array(conditieSchema).min(1),
      toetser: id,
      /** Bij een AI Act-signaal is de uitkomst minstens deze kleur. */
      minimale_uitkomst: id.optional(),
      /** Tekst in "Waarom deze kleur?" als het signaal de kleur verhoogde. */
      motivatie: tekst.optional(),
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

    const controleer = (waar: string, cond: Conditie) => {
      if ("extra_vraag" in cond) {
        if (!extraIds.has(cond.extra_vraag)) fout(`${waar}: onbekende extra vraag "${cond.extra_vraag}"`);
        return;
      }
      if ("rode_vlag" in cond) {
        if (!vlagIds.has(cond.rode_vlag)) fout(`${waar}: onbekende rode vlag "${cond.rode_vlag}"`);
        return;
      }
      const c = checkById.get(cond.check);
      if (!c) return fout(`${waar}: onbekende check "${cond.check}"`);
      if (cond.deelvraag && !c.deelvragen.some((d) => d.id === cond.deelvraag)) {
        fout(`${waar}: onbekende deelvraag "${cond.deelvraag}" bij check ${c.id}`);
      }
      for (const a of cond.antwoorden) {
        if (!c.antwoorden.some((x) => x.id === a)) fout(`${waar}: onbekend antwoord "${a}" bij check ${c.id}`);
      }
    };
    if (!toetserIds.has(r.dpia.toetser)) fout(`dpia: onbekende toetser "${r.dpia.toetser}"`);
    if (!toetserIds.has(r.ai_act.toetser)) fout(`ai_act: onbekende toetser "${r.ai_act.toetser}"`);
    if (r.ai_act.minimale_uitkomst && !kleurIds.has(r.ai_act.minimale_uitkomst)) {
      fout(`ai_act: onbekende kleur "${r.ai_act.minimale_uitkomst}"`);
    }
    for (const c of [...r.dpia.vereist, ...r.dpia.minstens_een_van, ...r.dpia.altijd_bij]) controleer("dpia", c);
    for (const c of r.ai_act.minstens_een_van) controleer("ai_act", c);
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

export const toolsSchema = z
  .object({
    versie: tekst,
    tools: z.array(z.object({ id, naam: tekst, omschrijving: tekst.optional(), spelregels: tekst })).min(1),
    behoeften: z.array(z.object({ id, omschrijving: tekst, tools: z.array(id).min(1) })).min(1),
    keuzehints: z.array(tekst).default([]),
  })
  .superRefine((t, ctx) => {
    const toolIds = new Set(t.tools.map((x) => x.id));
    const fout = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    dubbel(t.tools.map((x) => x.id), "tool", fout);
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
  onafgemaakt: z.object({ melding: tekst, knop: tekst }),
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
  ai_act: z.object({ titel: tekst, uitleg: tekst }),
  extra_regelen_titel: tekst,
  contact_opnieuw: z.object({ melding: tekst, knop: tekst }),
  beheer: z.object({ titel: tekst, intro: tekst }),
  dpia: z.object({ titel: tekst, uitleg: tekst }),
  coach_niet_beschikbaar: tekst,
});
export type Teksten = z.infer<typeof tekstenSchema>;

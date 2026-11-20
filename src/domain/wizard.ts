/**
 * De gegevens van een (onafgemaakte) wizard. Wordt als concept opgeslagen,
 * zodat terug/vooruit en herladen geen gegevens kost.
 */
import { z } from "zod";

const kort = z.string().trim().max(500);
const id = z.string().regex(/^[a-z0-9_]+$/).max(64);

export const MAX_VERDUIDELIJKENDE_VRAGEN = 2;

export const chatBerichtSchema = z.object({
  rol: z.enum(["coach", "medewerker"]),
  tekst: z.string().trim().min(1).max(2000),
});
export type ChatBericht = z.infer<typeof chatBerichtSchema>;

export const tooladviesSchema = z.object({
  behoefte: id.optional(),
  tool: id,
  motivatie: z.string().max(1000).default(""),
  /** Kwam het advies van de coach, of koos de medewerker zelf? */
  bron: z.enum(["coach", "medewerker"]),
  geaccepteerd: z.boolean().default(false),
});
export type Tooladvies = z.infer<typeof tooladviesSchema>;

export const checkVoorstelSchema = z.object({
  voorstel: id,
  zekerheid: z.enum(["hoog", "middel", "laag"]),
  vervolgvraag: z.string().max(500).optional(),
});

export const wizardDataSchema = z.object({
  stap: z.number().int().min(1).max(4).default(1),
  beschrijving: z.string().max(4000).default(""),
  verduidelijking: z
    .array(z.object({ vraag: kort, antwoord: z.string().max(1000).default("") }))
    .max(MAX_VERDUIDELIJKENDE_VRAGEN)
    .default([]),
  /** Heeft de coach al om verduidelijking gevraagd? (maximaal één ronde) */
  verduidelijkingGevraagd: z.boolean().default(false),
  tooladvies: tooladviesSchema.nullable().default(null),
  /** Tools die de medewerker niet wil (bij "andere tool vragen"). */
  uitgeslotenTools: z.array(id).max(10).default([]),
  /** check-id → antwoord-id, of een lijst bij een check met meerdere antwoorden. */
  checks: z.record(id, z.union([id, z.array(id).max(10)])).default({}),
  /** Voorstellen van de coach per check, om te tonen wat de coach dacht. */
  coachVoorstellen: z.record(id, checkVoorstelSchema).default({}),
  checksVoorgesteld: z.boolean().default(false),
  extraVragen: z.record(id, z.boolean()).default({}),
  rodeVlaggen: z.record(id, z.boolean()).default({}),
  chat: z.array(chatBerichtSchema).max(200).default([]),
  /** Bij "Er is iets veranderd": het advies waarop dit concept voortbouwt. */
  vorigAdviesId: z.string().uuid().nullable().default(null),
});
export type WizardData = z.infer<typeof wizardDataSchema>;

export function legeWizard(): WizardData {
  return wizardDataSchema.parse({});
}

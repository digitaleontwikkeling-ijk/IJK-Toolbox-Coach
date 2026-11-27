/**
 * Schema's voor de antwoorden van de coach. Ze worden opgebouwd uit de content,
 * zodat een tool of antwoord dat niet in de configuratie staat wordt geweigerd.
 */
import { z } from "zod";
import type { Content } from "../content/laad-content";
import { MAX_VERDUIDELIJKENDE_VRAGEN } from "../domain/wizard";

const tekst = (max: number) => z.string().trim().min(1).max(max);

/**
 * Verduidelijkende vragen: een losse vraag (open antwoord) of een vraag met 2 tot 6 antwoordopties.
 * De wizard voegt zelf "Iets anders…" toe, zodat de medewerker altijd een eigen antwoord kan geven.
 */
const verduidelijkendeVraag = z.union([
  tekst(300).transform((vraag) => ({ vraag, opties: [] as string[] })),
  z.object({ vraag: tekst(300), opties: z.array(tekst(100)).max(6).default([]) }),
]);
export const verduidelijkSchema = z.object({
  vragen: z.array(verduidelijkendeVraag).max(MAX_VERDUIDELIJKENDE_VRAGEN),
});

export function tooladviesSchema(content: Content, uitsluiten: string[] = []) {
  const toolIds = content.tools.tools.map((t) => t.id);
  const behoefteIds = content.tools.behoeften.map((b) => b.id);
  const inToolbox = z.string().refine((t) => toolIds.includes(t), "tool staat niet in de IJK Toolbox");
  return z
    .object({
      behoefte: z.string().refine((b) => behoefteIds.includes(b), "onbekende behoefte"),
      /** Wat de medewerker wil bereiken. */
      doel: tekst(300).optional(),
      tool: inToolbox.refine((t) => !uitsluiten.includes(t), "deze tool mag niet als hoofdtool"),
      /** De rol van de hoofdtool in de oplossing. */
      rol: tekst(300).optional(),
      motivatie: tekst(1000),
      aanvullend: z.array(z.object({ tool: inToolbox, rol: tekst(300) }).strip()).max(2).default([]),
      alternatieven: z.array(z.object({ tool: inToolbox, waarom_niet: tekst(300) }).strip()).max(3).default([]),
    })
    .strip()
    .superRefine((a, ctx) => {
      const aanvullend = a.aanvullend.map((x) => x.tool);
      if (aanvullend.includes(a.tool) || new Set(aanvullend).size !== aanvullend.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "aanvullende tools: dubbel of gelijk aan de hoofdtool" });
      }
      if (a.alternatieven.some((x) => x.tool === a.tool || aanvullend.includes(x.tool))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "een alternatief is ook de hoofdtool of een aanvullende tool" });
      }
      const teksten = [a.doel, a.rol, a.motivatie, ...a.aanvullend.map((x) => x.rol), ...a.alternatieven.map((x) => x.waarom_niet)];
      if (teksten.some((t) => t && claimtGoedkeuring(t))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "het advies presenteert de tool als goedgekeurd" });
      }
    });
}

/**
 * Het tooladvies gaat over welke tool functioneel past; of de use case mag, beoordelen de checks in fase 2.
 * Een advies dat de tool als goedgekeurd of toegestaan presenteert, wordt geweigerd.
 */
export function claimtGoedkeuring(tekst: string): boolean {
  return /\b(je|jij|u)\s+(mag|kunt|kan)\s+(deze tool|dit|het|hem|die)\s+(dus\s+|gewoon\s+|direct\s+|meteen\s+)?(gebruiken|inzetten)\s*(zonder|$|\.)|\b(is|zijn|wordt)\s+(al\s+|dus\s+)?(goedgekeurd|toegestaan)\s+voor\s+(deze|jouw|je|dit)\b|\bzonder\s+(toetsing|toetsen|checks|beoordeling)\b/i.test(tekst);
}

export const ZEKERHEDEN = ["hoog", "middel", "laag"] as const;

/**
 * Eén voorstel per check, of bij een check met deelvragen (Impact) één voorstel per deelvraag.
 * De waarde moet uit de schaal van die check komen.
 */
export function checkVoorstelSchema(content: Content) {
  const checks = new Map(content.regelset.checks.map((c) => [c.id, c]));
  return z
    .object({
      check: z.string(),
      deelvraag: z.string().optional(),
      voorstel: z.string(),
      zekerheid: z.enum(ZEKERHEDEN),
      vervolgvraag: tekst(300).optional(),
    })
    .strip()
    .refine((v) => checks.get(v.check)?.antwoorden.some((a) => a.id === v.voorstel) ?? false, "waarde staat niet in de schaal")
    .refine((v) => {
      const c = checks.get(v.check);
      if (!c) return false;
      // Deelvraag verplicht bij een check met deelvragen, en anders niet toegestaan.
      return c.deelvragen.length > 0 ? c.deelvragen.some((d) => d.id === v.deelvraag) : v.deelvraag === undefined;
    }, "deelvraag ontbreekt of bestaat niet");
}

export const checksAntwoordSchema = z.object({ checks: z.array(z.unknown()).max(20) });

export const uitlegSchema = z.object({ uitleg: tekst(3000) }).strip();
export const chatSchema = z.object({ antwoord: tekst(3000) }).strip();

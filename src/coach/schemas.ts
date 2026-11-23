/**
 * Schema's voor de antwoorden van de coach. Ze worden opgebouwd uit de content,
 * zodat een tool of antwoord dat niet in de configuratie staat wordt geweigerd.
 */
import { z } from "zod";
import type { Content } from "../content/laad-content";
import { MAX_VERDUIDELIJKENDE_VRAGEN } from "../domain/wizard";

const tekst = (max: number) => z.string().trim().min(1).max(max);

export const verduidelijkSchema = z.object({
  vragen: z.array(tekst(300)).max(MAX_VERDUIDELIJKENDE_VRAGEN),
});

export function tooladviesSchema(content: Content, uitsluiten: string[] = []) {
  const toolIds = content.tools.tools.map((t) => t.id);
  const behoefteIds = content.tools.behoeften.map((b) => b.id);
  return z
    .object({
      behoefte: z.string().refine((b) => behoefteIds.includes(b), "onbekende behoefte"),
      tool: z
        .string()
        .refine((t) => toolIds.includes(t), "tool staat niet in de IJK Toolbox")
        .refine((t) => !uitsluiten.includes(t), "deze tool wilde de medewerker niet"),
      motivatie: tekst(1000),
    })
    .strip();
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

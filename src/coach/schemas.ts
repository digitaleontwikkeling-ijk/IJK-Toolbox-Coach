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

/** Eén voorstel per check. De waarde moet uit de schaal van die check komen. */
export function checkVoorstelSchema(content: Content) {
  const schalen = new Map(content.regelset.checks.map((c) => [c.id, c.antwoorden.map((a) => a.id)]));
  return z
    .object({
      check: z.string(),
      voorstel: z.string(),
      zekerheid: z.enum(ZEKERHEDEN),
      vervolgvraag: tekst(300).optional(),
    })
    .strip()
    .refine((v) => schalen.get(v.check)?.includes(v.voorstel) ?? false, "waarde staat niet in de schaal");
}

export const checksAntwoordSchema = z.object({ checks: z.array(z.unknown()).max(20) });

export const uitlegSchema = z.object({ uitleg: tekst(3000) }).strip();
export const chatSchema = z.object({ antwoord: tekst(3000) }).strip();

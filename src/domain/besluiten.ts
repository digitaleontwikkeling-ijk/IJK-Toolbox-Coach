import { z } from "zod";
import { TOETSER_ROLLEN } from "../auth/rollen";
/**
 * Eindstatus van een aanvraag op basis van de besluiten van de toetsers (pure functie).
 *
 * Afspraak (fase 2, akkoord IJK):
 * - de status is pas definitief als ALLE toegewezen toetsers hebben besloten;
 * - één afwijzing → afgewezen;
 * - anders één keer "goedgekeurd met voorwaarden" → goedgekeurd met voorwaarden;
 * - anders → goedgekeurd.
 */
export const BESLUITEN = ["goedgekeurd", "goedgekeurd_met_voorwaarden", "afgewezen"] as const;
export type Besluit = (typeof BESLUITEN)[number];

export function eindstatus(
  toetsers: string[],
  besluiten: { toetserRol: string; besluit: Besluit }[],
): Besluit | null {
  const perRol = new Map(besluiten.filter((b) => toetsers.includes(b.toetserRol)).map((b) => [b.toetserRol, b.besluit]));
  if (toetsers.length === 0 || toetsers.some((t) => !perRol.has(t))) return null;
  const alle = [...perRol.values()];
  if (alle.includes("afgewezen")) return "afgewezen";
  if (alle.includes("goedgekeurd_met_voorwaarden")) return "goedgekeurd_met_voorwaarden";
  return "goedgekeurd";
}

/** Invoer van een toetser bij het vastleggen van een besluit. */
export const besluitInvoerSchema = z
  .object({
    besluit: z.enum(BESLUITEN),
    toelichting: z.string().trim().max(2000).optional().default(""),
    /** Alleen nodig als iemand meerdere toetserrollen heeft. */
    rol: z.enum(TOETSER_ROLLEN).optional(),
  })
  .superRefine((b, ctx) => {
    if (b.besluit === "goedgekeurd_met_voorwaarden" && b.toelichting.length < 5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toelichting"], message: "Beschrijf de voorwaarden." });
    }
    if (b.besluit === "afgewezen" && b.toelichting.length < 5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toelichting"], message: "Geef een motivatie voor de afwijzing." });
    }
  });


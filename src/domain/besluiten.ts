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

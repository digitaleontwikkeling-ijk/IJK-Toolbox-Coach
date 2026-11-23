/** Leesbare weergave van antwoorden (pure functies, ook bruikbaar in de browser). */
import { deelvraagAntwoord, gekozenIds, type BeslisInvoer } from "./beslisregels";
import type { Regelset } from "./content-schema";

/**
 * Per check de gekozen antwoorden als tekst, bijvoorbeeld
 * { Data: "Intern", Impact: "Beschikbaarheid: Serieus; Integriteit: Beperkt; Vertrouwelijkheid: Nauwelijks" }.
 */
export function antwoordLabels(regelset: Regelset, checks: BeslisInvoer["checks"]): Record<string, string> {
  const uit: Record<string, string> = {};
  const invoer: BeslisInvoer = { checks, rodeVlaggen: {} };
  for (const c of regelset.checks) {
    const label = (id: string | undefined) => c.antwoorden.find((a) => a.id === id)?.label ?? "";
    uit[c.naam] =
      c.deelvragen.length > 0
        ? c.deelvragen.map((d) => `${d.naam}: ${label(deelvraagAntwoord(invoer, c.id, d.id))}`).join("; ")
        : gekozenIds(invoer, c.id).map(label).join(", ");
  }
  return uit;
}

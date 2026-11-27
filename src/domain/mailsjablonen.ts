/**
 * Mailsjablonen voor de licentieaanvraag, per tool met een beheerder.
 * De standaard staat in content/teksten.yaml (aanvraag_mail); een beheerder kan per tool een eigen sjabloon
 * instellen (database). Pure functies; geen invloed op de uitkomst van een advies.
 */
import { z } from "zod";
import type { Teksten, ToolsConfig } from "./content-schema";

export interface Mailsjabloon {
  onderwerp: string;
  tekst: string;
}

/** De velden die in een sjabloon kunnen staan, met uitleg voor de beheerder. */
export const MAIL_VELDEN: { veld: string; uitleg: string }[] = [
  { veld: "{naam}", uitleg: "voornaam en achternaam van de aanvrager" },
  { veld: "{tool}", uitleg: "naam van de tool" },
  { veld: "{licentie}", uitleg: "naam van de licentie (tools.yaml)" },
  { veld: "{referentie}", uitleg: "referentienummer van het advies" },
  { veld: "{uitkomst}", uitleg: "uitkomst van het advies" },
  { veld: "{voorwaarden}", uitleg: "de voorwaarden, als lijst" },
  { veld: "{link}", uitleg: "link naar het advies" },
];

export const mailsjabloonSchema = z.object({
  onderwerp: z.string().trim().min(1, "Vul een onderwerp in.").max(200),
  tekst: z.string().trim().min(1, "Vul een tekst in.").max(4000),
});

export function standaardSjabloon(teksten: Pick<Teksten, "aanvraag_mail">): Mailsjabloon {
  return { onderwerp: teksten.aanvraag_mail.onderwerp, tekst: teksten.aanvraag_mail.tekst };
}

/** Per tool met een beheerder het sjabloon dat geldt: het eigen sjabloon van de beheerder, of de standaard. */
export function mailsjablonen(
  tools: ToolsConfig,
  teksten: Pick<Teksten, "aanvraag_mail">,
  eigen: Record<string, Mailsjabloon>,
): Record<string, Mailsjabloon & { aangepast: boolean }> {
  const standaard = standaardSjabloon(teksten);
  return Object.fromEntries(
    tools.tools
      .filter((t) => t.beheer)
      .map((t) => [t.id, eigen[t.id] ? { ...eigen[t.id]!, aangepast: true } : { ...standaard, aangepast: false }]),
  );
}

/** Naam van de licentie in de mail: uit tools.yaml, anders "<tool>-licentie". */
export function licentieNaam(tools: ToolsConfig, toolId: string): string {
  const t = tools.tools.find((x) => x.id === toolId);
  return t?.beheer?.licentienaam ?? `${t?.naam ?? toolId}-licentie`;
}

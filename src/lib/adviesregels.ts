/**
 * De adviesregels die nu gelden, voor elk nieuw tooladvies opnieuw opgehaald: de standaard uit
 * content/adviesregels.yaml met de wijzigingen van de beheerder (database) erover.
 *
 * Terugval: lukt het ophalen niet, dan gelden de laatst bekende geldige regels; is die er niet (net gestart), dan de
 * standaard uit content/. Een ongeldige opgeslagen regel wordt overgeslagen (dan geldt de standaard). Zo blijft de
 * coach werken, en nooit met een ongeldige set.
 */
import { haalAdviesregels } from "@/db/adviesregels";
import { controleer, regelsVersie, samenvoegen, type RegelMetStatus } from "@/domain/adviesregels";
import { content } from "./app";

export type RegelsBron = "database" | "laatst_bekend" | "standaard";
export interface ActieveRegels {
  regels: RegelMetStatus[];
  versie: string;
  bron: RegelsBron;
}

let laatstBekend: Omit<ActieveRegels, "bron"> | undefined;

export function standaardRegels(): Omit<ActieveRegels, "bron"> {
  const c = content();
  return { regels: samenvoegen(c.adviesregels.regels, {}, c.tools.tools).regels, versie: c.adviesregels.versie };
}

export async function actieveAdviesregels(ophalen: typeof haalAdviesregels = haalAdviesregels): Promise<ActieveRegels> {
  const c = content();
  try {
    const { opgeslagen, laatsteWijziging } = await ophalen();
    const s = samenvoegen(c.adviesregels.regels, opgeslagen, c.tools.tools);
    if (s.overgeslagen.length) console.warn(`Adviesregels: ongeldige opgeslagen regel(s) overgeslagen: ${s.overgeslagen.join(", ")}.`);
    const fouten = controleer(s.regels, c.tools.tools).fouten;
    if (fouten.length) throw new Error(`de opgeslagen set klopt niet (${fouten.length} fout(en))`);
    laatstBekend = { regels: s.regels, versie: regelsVersie(c.adviesregels.versie, laatsteWijziging) };
    return { ...laatstBekend, bron: "database" };
  } catch (e) {
    console.warn(`Adviesregels konden niet worden opgehaald (${(e as Error).message}); terugval op ${laatstBekend ? "de laatst bekende regels" : "de standaard"}.`);
    return laatstBekend ? { ...laatstBekend, bron: "laatst_bekend" } : { ...standaardRegels(), bron: "standaard" };
  }
}

/** Alleen voor tests. */
export function vergeetLaatstBekend() {
  laatstBekend = undefined;
}

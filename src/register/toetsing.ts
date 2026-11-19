/**
 * Toetsing en beheer: inzage (altijd met audit-log) en besluiten van toetsers.
 */
import type { z } from "zod";
import type { Gebruiker } from "../auth/sessie";
import { TOETSER_ROLLEN, type Rol } from "../auth/rollen";
import { eindstatus, type besluitInvoerSchema } from "../domain/besluiten";
export { besluitInvoerSchema } from "../domain/besluiten";
import { db, transactie } from "../db/pool";
import {
  adviezenVoorToetsers,
  alleAdviezen,
  audit,
  besluitenVan,
  haalAdvies,
  voegBesluitToe,
  zetStatusNaBesluit,
  type BesluitRij,
} from "../db/toetsing";
import type { AdviesRij } from "../db/adviezen";
import { ApiFout, nietGevonden } from "../lib/api";

export function toetserRollen(g: Gebruiker): string[] {
  return g.rollen.filter((r) => (TOETSER_ROLLEN as readonly Rol[]).includes(r));
}

/** Een advies met besluiten, zoals toetsers en beheerders het zien. */
export interface AdviesMetBesluiten extends AdviesRij {
  besluiten: Omit<BesluitRij, "toetserPseudoniemId">[];
}

async function metBesluiten(adviezen: AdviesRij[]): Promise<AdviesMetBesluiten[]> {
  const besluiten = await besluitenVan(adviezen.map((a) => a.id));
  return adviezen.map((a) => ({
    ...a,
    besluiten: besluiten.filter((b) => b.adviesId === a.id).map(({ toetserPseudoniemId: _, ...b }) => b),
  }));
}

// ---------- Toetsers ----------

export async function lijstVoorToetser(g: Gebruiker): Promise<AdviesMetBesluiten[]> {
  const rollen = toetserRollen(g);
  await audit(db(), { pseudoniemId: g.pseudoniemId, rol: rollen.join(","), actie: "inzage_lijst" });
  return metBesluiten(await adviezenVoorToetsers(rollen));
}

/**
 * Een toetser ziet alleen ingediende aanvragen die naar zijn rol zijn gestuurd; anders 404.
 * `openRollen`: rollen waarvoor deze toetser nu nog een besluit kan vastleggen.
 */
export async function detailVoorToetser(g: Gebruiker, id: string): Promise<AdviesMetBesluiten & { openRollen: string[]; eigenAanvraag: boolean }> {
  const rollen = toetserRollen(g);
  const advies = await haalAdvies(id);
  if (!advies || advies.status === "advies_gegeven" || !advies.toetsers.some((t) => rollen.includes(t))) throw nietGevonden();
  await audit(db(), { pseudoniemId: g.pseudoniemId, rol: rollen.join(","), actie: "inzage_advies", adviesId: id });
  const detail = (await metBesluiten([advies]))[0]!;
  const eigenAanvraag = advies.pseudoniemId === g.pseudoniemId;
  const openRollen =
    advies.status !== "in_toetsing" || eigenAanvraag
      ? []
      : advies.toetsers.filter((t) => rollen.includes(t) && !detail.besluiten.some((b) => b.toetserRol === t));
  return { ...detail, openRollen, eigenAanvraag };
}

export async function legBesluitVast(g: Gebruiker, id: string, invoer: z.output<typeof besluitInvoerSchema>) {
  const mijnRollen = toetserRollen(g);
  return transactie(async (q) => {
    const advies = await haalAdvies(id, q, { voorUpdate: true });
    if (!advies || advies.status === "advies_gegeven") throw nietGevonden();
    const passend = advies.toetsers.filter((t) => mijnRollen.includes(t));
    if (passend.length === 0) throw nietGevonden();
    if (advies.pseudoniemId === g.pseudoniemId) throw new ApiFout(403, "Je kunt je eigen aanvraag niet toetsen.");
    if (advies.status !== "in_toetsing") throw new ApiFout(409, "Over deze aanvraag is al een besluit genomen.");

    const rol = invoer.rol ?? (passend.length === 1 ? passend[0]! : null);
    if (!rol || !passend.includes(rol)) throw new ApiFout(400, "Geef aan namens welke toetserrol je besluit.");

    const eerdere = await besluitenVan([id], q);
    if (eerdere.some((b) => b.toetserRol === rol)) throw new ApiFout(409, "Voor deze rol is al een besluit vastgelegd.");

    await voegBesluitToe(q, {
      adviesId: id,
      toetserRol: rol,
      toetserPseudoniemId: g.pseudoniemId,
      besluit: invoer.besluit,
      toelichting: invoer.toelichting || null,
    });
    await audit(q, { pseudoniemId: g.pseudoniemId, rol, actie: "besluit", adviesId: id });

    const status = eindstatus(advies.toetsers, [...eerdere, { toetserRol: rol, besluit: invoer.besluit }]);
    if (status) await zetStatusNaBesluit(q, id, status);
    return { status: status ?? advies.status };
  });
}

// ---------- Beheerders ----------

export async function lijstVoorBeheer(g: Gebruiker): Promise<AdviesMetBesluiten[]> {
  await audit(db(), { pseudoniemId: g.pseudoniemId, rol: "beheerder", actie: "inzage_lijst" });
  return metBesluiten(await alleAdviezen());
}

export async function detailVoorBeheer(g: Gebruiker, id: string): Promise<AdviesMetBesluiten> {
  const advies = await haalAdvies(id);
  if (!advies) throw nietGevonden();
  await audit(db(), { pseudoniemId: g.pseudoniemId, rol: "beheerder", actie: "inzage_advies", adviesId: id });
  return (await metBesluiten([advies]))[0]!;
}

/** Besluiten bij een eigen advies, voor de medewerker (zonder wie er besloot). */
export async function besluitenVoorMedewerker(adviesId: string) {
  return (await besluitenVan([adviesId])).map(({ toetserRol, besluit, toelichting, datum }) => ({ toetserRol, besluit, toelichting, datum }));
}

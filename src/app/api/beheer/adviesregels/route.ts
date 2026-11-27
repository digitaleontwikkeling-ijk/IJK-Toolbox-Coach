/**
 * Beheer van de adviesregels voor het tooladvies. Alleen voor beheerders; elke wijziging komt in de audit-log en in
 * de wijzigingshistorie. Zelfde patroon als de mailsjablonen: de standaard staat in content/adviesregels.yaml, de
 * database bewaart alleen wat de beheerder anders wil.
 *
 * GET: alle regels (actief en inactief) met status, verwijderde standaardregels, historie en controle.
 * POST: { actie: "toevoegen", regel } | { actie: "terugzetten", historie: nr }
 * PUT: { regel } (wijzigen, ook activeren/deactiveren)
 * DELETE: { id, standaard?: true } (verwijderen, of met standaard: true terug naar de standaard)
 *
 * Elke wijziging wordt eerst gecontroleerd op de hele set; bij een fout wordt niets opgeslagen (400 met uitleg) en
 * blijven de huidige regels actief.
 */
import { z } from "zod";
import { audit } from "@/db/toetsing";
import { db, transactie } from "@/db/pool";
import { haalAdviesregels, haalHistorie, haalHistorieRegel, zetAdviesregel } from "@/db/adviesregels";
import { controleer, pasToe, regelsVersie, RegelFout, samenvoegen, type Mutatie } from "@/domain/adviesregels";
import { ApiFout, body, route } from "@/lib/api";
import { content } from "@/lib/app";

const sleutel = z.string().regex(/^[a-z0-9_]{1,60}$/);

async function overzicht() {
  const c = content();
  const { opgeslagen, laatsteWijziging } = await haalAdviesregels();
  const s = samenvoegen(c.adviesregels.regels, opgeslagen, c.tools.tools);
  return {
    regels: s.regels,
    verwijderdeStandaard: s.verwijderdeStandaard,
    historie: await haalHistorie(),
    versie: regelsVersie(c.adviesregels.versie, laatsteWijziging),
    controle: controleer(s.regels, c.tools.tools),
  };
}

async function voerUit(mutatie: (opgeslagen: Awaited<ReturnType<typeof haalAdviesregels>>["opgeslagen"]) => Promise<Mutatie> | Mutatie, door: string) {
  const c = content();
  try {
    const waarschuwingen = await transactie(async (q) => {
      // Eén wijziging tegelijk: zo controleren we altijd de set zoals die werkelijk wordt.
      await q.query("LOCK TABLE adviesregel IN EXCLUSIVE MODE");
      const { opgeslagen } = await haalAdviesregels(q);
      const w = pasToe(c.adviesregels.regels, opgeslagen, c.tools.tools, await mutatie(opgeslagen));
      await zetAdviesregel(q, w, door);
      await audit(q, { pseudoniemId: door, rol: "beheerder", actie: "adviesregel_gewijzigd" });
      return w.waarschuwingen;
    });
    return { ...(await overzicht()), waarschuwingen };
  } catch (e) {
    if (e instanceof RegelFout) throw new ApiFout(400, e.message, e.details);
    throw e;
  }
}

export const GET = route(["beheerder"], async () => overzicht());

export const POST = route(["beheerder"], async ({ req, gebruiker }) => {
  const b = await body(
    req,
    z.discriminatedUnion("actie", [
      z.object({ actie: z.literal("toevoegen"), regel: z.record(z.unknown()) }),
      z.object({ actie: z.literal("terugzetten"), historie: z.number().int().positive() }),
    ]),
  );
  return voerUit(async () => {
    if (b.actie === "toevoegen") return { actie: "toevoegen", regel: b.regel as never };
    const h = await haalHistorieRegel(db(), b.historie);
    if (!h) throw new RegelFout("Deze versie bestaat niet (meer).");
    return { actie: "terugzetten", historie: h };
  }, gebruiker.pseudoniemId);
});

export const PUT = route(["beheerder"], async ({ req, gebruiker }) => {
  const b = await body(req, z.object({ regel: z.record(z.unknown()) }));
  return voerUit(() => ({ actie: "wijzigen", regel: b.regel as never }), gebruiker.pseudoniemId);
});

export const DELETE = route(["beheerder"], async ({ req, gebruiker }) => {
  const b = await body(req, z.object({ id: sleutel, standaard: z.boolean().optional() }));
  return voerUit(() => (b.standaard ? { actie: "standaard", id: b.id } : { actie: "verwijderen", id: b.id }), gebruiker.pseudoniemId);
});

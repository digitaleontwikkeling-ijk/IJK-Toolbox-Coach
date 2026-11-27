/**
 * Mailsjablonen voor de licentieaanvraag: per tool met een beheerder. Alleen voor beheerders; elke wijziging
 * komt in de audit-log. GET: alle sjablonen (eigen of standaard). PUT: eigen sjabloon opslaan. DELETE: terug naar standaard.
 */
import { z } from "zod";
import { audit } from "@/db/toetsing";
import { db } from "@/db/pool";
import { haalMailsjablonen, verwijderMailsjabloon, zetMailsjabloon } from "@/db/mailsjablonen";
import { mailsjabloonSchema, mailsjablonen, standaardSjabloon } from "@/domain/mailsjablonen";
import { ApiFout, body, route } from "@/lib/api";
import { content } from "@/lib/app";

const toolMetBeheer = (id: string) => {
  const t = content().tools.tools.find((x) => x.id === id);
  if (!t?.beheer) throw new ApiFout(400, "Onbekende tool, of een tool zonder beheerder.");
  return t;
};

async function overzicht() {
  const c = content();
  return { sjablonen: mailsjablonen(c.tools, c.teksten, await haalMailsjablonen()), standaard: standaardSjabloon(c.teksten) };
}

export const GET = route(["beheerder"], async () => overzicht());

export const PUT = route(["beheerder"], async ({ req, gebruiker }) => {
  const b = await body(req, mailsjabloonSchema.extend({ tool: z.string().max(64) }));
  toolMetBeheer(b.tool);
  await zetMailsjabloon(db(), b.tool, { onderwerp: b.onderwerp, tekst: b.tekst }, gebruiker.pseudoniemId);
  await audit(db(), { pseudoniemId: gebruiker.pseudoniemId, rol: "beheerder", actie: "mailsjabloon_gewijzigd" });
  return overzicht();
});

export const DELETE = route(["beheerder"], async ({ req, gebruiker }) => {
  const b = await body(req, z.object({ tool: z.string().max(64) }));
  toolMetBeheer(b.tool);
  await verwijderMailsjabloon(db(), b.tool);
  await audit(db(), { pseudoniemId: gebruiker.pseudoniemId, rol: "beheerder", actie: "mailsjabloon_gewijzigd" });
  return overzicht();
});

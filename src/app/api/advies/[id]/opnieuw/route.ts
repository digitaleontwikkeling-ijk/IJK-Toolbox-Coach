/** "Er is iets veranderd": nieuw concept met de antwoorden van het vorige advies. */
import { haalEigenAdvies, maakConcept } from "@/db/adviezen";
import { nietGevonden, route, vereisUuid } from "@/lib/api";
import { wizardUitAdvies } from "@/register/register";

export const POST = route<{ id: string }>(["medewerker"], async ({ gebruiker, params }) => {
  const advies = await haalEigenAdvies(vereisUuid(params.id), gebruiker.pseudoniemId);
  if (!advies) throw nietGevonden();
  const c = await maakConcept(gebruiker.pseudoniemId, wizardUitAdvies(advies));
  return { concept: { id: c.id, adviesId: null, data: c.data } };
});

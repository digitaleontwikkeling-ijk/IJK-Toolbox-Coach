import { haalEigenAdvies } from "@/db/adviezen";
import { nietGevonden, route, vereisUuid } from "@/lib/api";
import { zonderPseudoniem } from "@/lib/weergave";
import { besluitenVoorMedewerker } from "@/register/toetsing";

/** Eén eigen advies, met de besluiten van de toetsers. */
export const GET = route<{ id: string }>(["medewerker"], async ({ gebruiker, params }) => {
  const advies = await haalEigenAdvies(vereisUuid(params.id), gebruiker.pseudoniemId);
  if (!advies) throw nietGevonden();
  return { advies: { ...zonderPseudoniem(advies), besluiten: await besluitenVoorMedewerker(advies.id) } };
});

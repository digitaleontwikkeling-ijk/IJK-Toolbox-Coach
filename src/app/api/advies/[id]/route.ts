import { haalEigenAdvies } from "@/db/adviezen";
import { nietGevonden, route, vereisUuid } from "@/lib/api";
import { zonderPseudoniem } from "@/lib/weergave";

/** Eén eigen advies. (Toetsers en beheerders krijgen in fase 5 een eigen route met audit-logging.) */
export const GET = route<{ id: string }>(["medewerker"], async ({ gebruiker, params }) => {
  const advies = await haalEigenAdvies(vereisUuid(params.id), gebruiker.pseudoniemId);
  if (!advies) throw nietGevonden();
  return { advies: zonderPseudoniem(advies) };
});

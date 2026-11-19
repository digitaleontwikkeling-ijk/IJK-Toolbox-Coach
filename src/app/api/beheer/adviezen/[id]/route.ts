import { route, vereisUuid } from "@/lib/api";
import { detailVoorBeheer } from "@/register/toetsing";

export const GET = route<{ id: string }>(["beheerder"], async ({ gebruiker, params }) => ({
  advies: await detailVoorBeheer(gebruiker, vereisUuid(params.id)),
}));

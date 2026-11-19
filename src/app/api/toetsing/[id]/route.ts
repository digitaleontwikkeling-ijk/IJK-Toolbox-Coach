import { route, vereisUuid } from "@/lib/api";
import { detailVoorToetser } from "@/register/toetsing";

export const GET = route<{ id: string }>(["toetser_compliance", "toetser_architect"], async ({ gebruiker, params }) => ({
  advies: await detailVoorToetser(gebruiker, vereisUuid(params.id)),
}));

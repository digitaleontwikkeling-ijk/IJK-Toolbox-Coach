import { route, vereisUuid } from "@/lib/api";
import { content } from "@/lib/app";
import { voerVervolgactieUit } from "@/register/register";

export const POST = route<{ id: string }>(["medewerker"], async ({ gebruiker, params }) =>
  voerVervolgactieUit({ adviesId: vereisUuid(params.id), pseudoniemId: gebruiker.pseudoniemId, content: content() }),
);

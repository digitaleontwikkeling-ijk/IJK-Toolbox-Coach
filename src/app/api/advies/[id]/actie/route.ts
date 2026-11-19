import { voerVervolgactieUit } from "@/acties/vervolgactie";
import { route, vereisUuid } from "@/lib/api";
import { actieClient, content } from "@/lib/app";
import { config } from "@/lib/config";

export const POST = route<{ id: string }>(["medewerker"], async ({ gebruiker, params }) =>
  voerVervolgactieUit({
    adviesId: vereisUuid(params.id),
    gebruiker,
    content: content(),
    client: actieClient(),
    appUrl: config.appUrl,
    stuurUpn: config.actieStuurUpn,
  }),
);

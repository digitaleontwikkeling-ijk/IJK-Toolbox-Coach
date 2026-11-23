/** Advies berekenen en vastleggen in het adviesregister. */
import { z } from "zod";
import { body, route, vereisUuid } from "@/lib/api";
import { actieClient, content } from "@/lib/app";
import { meldContactIndienNodig } from "@/acties/vervolgactie";
import { config } from "@/lib/config";
import { registreerAdvies } from "@/register/register";
import { zonderPseudoniem } from "@/lib/weergave";

export const POST = route(["medewerker"], async ({ req, gebruiker }) => {
  const b = await body(req, z.object({ conceptId: z.string() }));
  const advies = await registreerAdvies({
    conceptId: vereisUuid(b.conceptId),
    pseudoniemId: gebruiker.pseudoniemId,
    content: content(),
    bewaartermijnMaanden: config.bewaartermijnMaanden,
    aanvrager: config.aanvragerOpslaan ? { naam: gebruiker.naam, email: gebruiker.upn ?? null } : null,
  });
  // Rood zonder alternatief: direct contact met Team Digitale Ontwikkeling (max. één keer per advies).
  const status = await meldContactIndienNodig(advies, {
    gebruiker,
    content: content(),
    client: actieClient(),
    appUrl: config.appUrl,
    stuurUpn: config.actieStuurUpn,
  });
  return { advies: zonderPseudoniem({ ...advies, status }) };
});


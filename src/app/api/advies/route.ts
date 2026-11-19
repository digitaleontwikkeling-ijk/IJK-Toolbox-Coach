/** Advies berekenen en vastleggen in het adviesregister. */
import { z } from "zod";
import { body, route, vereisUuid } from "@/lib/api";
import { content } from "@/lib/app";
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
  });
  return { advies: zonderPseudoniem(advies) };
});


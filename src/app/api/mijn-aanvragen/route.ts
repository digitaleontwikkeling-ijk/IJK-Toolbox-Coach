import { eigenAdviezen } from "@/db/adviezen";
import { route } from "@/lib/api";
import { zonderPseudoniem } from "@/lib/weergave";

export const GET = route(["medewerker"], async ({ gebruiker }) => ({
  adviezen: (await eigenAdviezen(gebruiker.pseudoniemId)).map(zonderPseudoniem),
}));

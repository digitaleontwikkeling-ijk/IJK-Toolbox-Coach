/** De content voor de interface: checks, schalen, tools, spelregels en teksten. */
import { ROLLEN } from "@/auth/rollen";
import { route } from "@/lib/api";
import { content } from "@/lib/app";
import { haalMailsjablonen } from "@/db/mailsjablonen";
import { mailsjablonen } from "@/domain/mailsjablonen";
import { actieveRegels, zonderStatus } from "@/domain/adviesregels";
import { actieveAdviesregels } from "@/lib/adviesregels";

export const GET = route([...ROLLEN], async ({ gebruiker }) => {
  const c = content();
  return {
    regelset: c.regelset,
    tools: c.tools,
    spelregels: c.spelregels,
    teksten: c.teksten,
    iconen: c.iconen,
    // Per tool het mailsjabloon voor de licentieaanvraag (eigen sjabloon van de beheerder of de standaard).
    mailsjablonen: mailsjablonen(c.tools, c.teksten, await haalMailsjablonen()),
    // De actieve adviesregels (met wijzigingen van de beheerder), voor de keuzehulp bij het kiezen van een tool.
    adviesregelsActief: actieveRegels((await actieveAdviesregels()).regels).map(zonderStatus),
    gebruiker: { naam: gebruiker.naam, rollen: gebruiker.rollen },
  };
});

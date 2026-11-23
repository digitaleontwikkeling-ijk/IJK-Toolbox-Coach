/** De content voor de interface: checks, schalen, tools, spelregels en teksten. */
import { ROLLEN } from "@/auth/rollen";
import { route } from "@/lib/api";
import { content } from "@/lib/app";

export const GET = route([...ROLLEN], async ({ gebruiker }) => {
  const c = content();
  return {
    regelset: c.regelset,
    tools: c.tools,
    spelregels: c.spelregels,
    teksten: c.teksten,
    iconen: c.iconen,
    gebruiker: { naam: gebruiker.naam, rollen: gebruiker.rollen },
  };
});

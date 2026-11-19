/** Gedeelde onderdelen van de server: content en coach. */
import { content } from "../content/laad-content";
import { CoachService, maakCoachClient } from "../coach/service";
import { config } from "./config";

let coach: CoachService | undefined;

export function coachService(): CoachService {
  const modus = config.coachModus;
  coach ??= new CoachService(
    maakCoachClient(modus, content(), modus === "hermes" ? config.hermes : undefined),
    content(),
    config.coachTimeoutMs + 1_000, // iets ruimer dan de client, zodat de client zelf netjes afbreekt
  );
  return coach;
}

export { content };

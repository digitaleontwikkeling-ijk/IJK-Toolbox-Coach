/** Gedeelde onderdelen van de server: content en coach. */
import { content } from "../content/laad-content";
import { CoachService, maakCoachClient } from "../coach/service";
import { config } from "./config";

let coach: CoachService | undefined;

export function coachService(): CoachService {
  coach ??= new CoachService(maakCoachClient(config.coachModus, content()), content());
  return coach;
}

export { content };

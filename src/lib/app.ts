/** Gedeelde onderdelen van de server: content en coach. */
import { content } from "../content/laad-content";
import { CoachService, maakCoachClient } from "../coach/service";
import { config } from "./config";
import { LogActieClient, WebhookActieClient, type ActieClient } from "../acties/ActieClient";

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

let acties: ActieClient | undefined;

export function actieClient(): ActieClient {
  acties ??= config.actieModus === "webhook" ? new WebhookActieClient(config.webhooks) : new LogActieClient();
  return acties;
}

export { content };

/**
 * Vervolgacties: aanroepen van de flows die IJK zelf beheert (bijvoorbeeld in
 * HubBI of Microsoft 365). Voor de app zijn het gewone
 * webhooks: een URL plus een gedeeld geheim in een header.
 *
 * Dataminimalisatie: de payload bevat geen beschrijving en geen antwoorden,
 * alleen wat de flow nodig heeft plus een link naar de app. De UPN gaat alleen
 * mee als ACTIE_STUUR_UPN=true.
 */
export type ActieType = "accountaanvraag" | "toetsing" | "teams_melding" | "contact";

export interface ActiePayload {
  type: ActieType;
  referentie: string;
  adviesId: string;
  aanvrager: { pseudoniemId: string; upn?: string };
  link: string;
  regelversie: string;
  [extra: string]: unknown;
}

export interface ActieResultaat {
  ok: boolean;
  /** "verstuurd" (webhook), "gelogd" (mock) of "mislukt" */
  resultaat: "verstuurd" | "gelogd" | "mislukt";
  httpStatus?: number;
  melding?: string;
}

export interface ActieClient {
  verstuur(payload: ActiePayload): Promise<ActieResultaat>;
}

/** Mock voor ontwikkeling: logt de aanroep alleen. */
export class LogActieClient implements ActieClient {
  async verstuur(payload: ActiePayload): Promise<ActieResultaat> {
    console.info(`[actie-mock] ${payload.type} ${payload.referentie}: ${JSON.stringify(payload)}`);
    return { ok: true, resultaat: "gelogd" };
  }
}

export interface WebhookInstellingen {
  urls: Record<ActieType, string>;
  geheim: string;
  geheimHeader: string;
  timeoutMs: number;
}

/** Roept de geconfigureerde webhook aan, met het gedeelde geheim in een header. */
export class WebhookActieClient implements ActieClient {
  constructor(private readonly instellingen: WebhookInstellingen, private readonly doeFetch: typeof fetch = fetch) {}

  async verstuur(payload: ActiePayload): Promise<ActieResultaat> {
    const { urls, geheim, geheimHeader, timeoutMs } = this.instellingen;
    try {
      const res = await this.doeFetch(urls[payload.type], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [geheimHeader]: geheim,
          // Zelfde actie opnieuw versturen → zelfde sleutel; de flow kan dubbele aanroepen negeren.
          "Idempotency-Key": `${payload.adviesId}:${payload.type}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return { ok: false, resultaat: "mislukt", httpStatus: res.status, melding: `HTTP ${res.status}` };
      return { ok: true, resultaat: "verstuurd", httpStatus: res.status };
    } catch (e) {
      return { ok: false, resultaat: "mislukt", melding: (e as Error).message.slice(0, 200) };
    }
  }
}

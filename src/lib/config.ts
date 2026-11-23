/**
 * Instellingen uit omgevingsvariabelen. Geen geheimen in de code: zie .env.example.
 */
function verplicht(naam: string): string {
  const waarde = process.env[naam];
  if (!waarde) throw new Error(`Omgevingsvariabele ${naam} ontbreekt. Zie .env.example.`);
  return waarde;
}

function getal(naam: string, standaard: number): number {
  const waarde = process.env[naam];
  if (waarde === undefined || waarde === "") return standaard;
  const n = Number(waarde);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Omgevingsvariabele ${naam} moet een positief getal zijn.`);
  return n;
}

export const config = {
  get databaseUrl() {
    return verplicht("DATABASE_URL");
  },
  /** Geheim om de sessiecookie te ondertekenen. */
  get sessieGeheim() {
    return verplicht("SESSIE_GEHEIM");
  },
  /** Geheim om van een Entra-ID een pseudoniem te maken. Niet wijzigen na livegang. */
  get pseudoniemGeheim() {
    return verplicht("PSEUDONIEM_GEHEIM");
  },
  /** "nep" = testgebruikers (proof of concept); "entra" = Microsoft Entra ID / Teams-SSO. */
  get authModus(): "nep" | "entra" {
    const m = process.env.AUTH_MODUS ?? "nep";
    if (m !== "nep" && m !== "entra") throw new Error(`AUTH_MODUS "${m}" wordt niet ondersteund.`);
    return m;
  },
  /** Instellingen voor Entra ID (alleen bij AUTH_MODUS=entra). Geen geheimen: alleen id's. */
  get entra() {
    const tenantId = verplicht("ENTRA_TENANT_ID");
    const clientId = verplicht("ENTRA_CLIENT_ID");
    return {
      tenantId,
      clientId,
      /** Application ID URI, bijvoorbeeld api://coach.ijk.nl/<clientId> */
      appIdUri: verplicht("ENTRA_APP_ID_URI"),
      /** Rol die elke ingelogde medewerker krijgt, naast de App Roles uit het token. */
      standaardRol: process.env.ENTRA_STANDAARD_ROL ?? "medewerker",
      jwksUrl: process.env.ENTRA_JWKS_URL ?? `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    };
  },
  /**
   * De sessiecookie moet ook werken als de app in een iframe van Teams draait
   * (andere site): dan SameSite=None; Secure; Partitioned. Standaard aan bij Entra.
   */
  get cookieInIframe() {
    const w = process.env.SESSIE_IN_IFRAME;
    return w === undefined ? this.authModus === "entra" : w === "true";
  },
  /** "hermes" = Hermes Agent, "mock" = vaste antwoorden zonder AI, "uit" = geen coach. */
  get coachModus(): "mock" | "hermes" | "uit" {
    const m = process.env.COACH_MODUS ?? "mock";
    if (m !== "mock" && m !== "hermes" && m !== "uit") throw new Error(`COACH_MODUS "${m}" wordt niet ondersteund.`);
    return m;
  },
  /** Maximale wachttijd op de coach per verzoek, in milliseconden. */
  get coachTimeoutMs() {
    return getal("COACH_TIMEOUT_MS", 30_000);
  },
  /** Instellingen voor Hermes (alleen nodig bij COACH_MODUS=hermes). */
  get hermes() {
    const apiUrl = verplicht("HERMES_API_URL");
    const url = new URL(apiUrl);
    const lokaal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !lokaal && process.env.NODE_ENV === "production") {
      console.warn("Let op: HERMES_API_URL gebruikt geen https. Gebruik https buiten een afgeschermd netwerk.");
    }
    return {
      apiUrl,
      apiKey: verplicht("HERMES_API_KEY"),
      model: process.env.HERMES_MODEL ?? "toolbox-coach",
      timeoutMs: this.coachTimeoutMs,
    };
  },
  /** Bewaartermijn van adviezen in het register, in maanden. */
  get bewaartermijnMaanden() {
    return getal("BEWAARTERMIJN_MAANDEN", 12);
  },
  /** Hoe lang een onafgemaakte wizard (inclusief chat) bewaard blijft, in dagen. */
  get conceptBewaardagen() {
    return getal("CONCEPT_BEWAARDAGEN", 30);
  },
  /** "mock" = acties alleen loggen; "webhook" = echte webhooks aanroepen. */
  get actieModus(): "mock" | "webhook" {
    const m = process.env.ACTIE_MODUS ?? "mock";
    if (m !== "mock" && m !== "webhook") throw new Error(`ACTIE_MODUS "${m}" wordt niet ondersteund.`);
    return m;
  },
  get webhooks() {
    return {
      urls: {
        accountaanvraag: verplicht("ACTIE_ACCOUNT_URL"),
        toetsing: verplicht("ACTIE_TOETSING_URL"),
        teams_melding: verplicht("ACTIE_MELDING_URL"),
        contact: verplicht("ACTIE_CONTACT_URL"),
      },
      geheim: verplicht("ACTIE_GEHEIM"),
      geheimHeader: process.env.ACTIE_GEHEIM_HEADER ?? "X-IJK-Webhook-Secret",
      timeoutMs: getal("ACTIE_TIMEOUT_MS", 10_000),
    };
  },
  /**
   * Naam en e-mailadres van de aanvrager opslaan bij het advies, zodat toetsers en beheerders zien wie de
   * aanvraag indiende (standaard aan). Gaat nooit naar de coach.
   */
  get aanvragerOpslaan() {
    return process.env.AANVRAGER_OPSLAAN !== "false";
  },
  /** Stuur de UPN van de aanvrager mee met acties (standaard uit: alleen pseudoniem). */
  get actieStuurUpn() {
    return process.env.ACTIE_STUUR_UPN === "true";
  },
  /** Publieke URL van de app, voor links in meldingen. */
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
};

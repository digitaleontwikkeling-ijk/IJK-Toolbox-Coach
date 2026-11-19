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
  /** "nep" = testgebruikers (proof of concept). Later: "entra". */
  get authModus(): "nep" {
    const m = process.env.AUTH_MODUS ?? "nep";
    if (m !== "nep") throw new Error(`AUTH_MODUS "${m}" wordt nog niet ondersteund.`);
    return m;
  },
  /** "mock" = vaste antwoorden zonder AI. "hermes" volgt in fase 4. "uit" = geen coach. */
  get coachModus(): "mock" | "uit" {
    const m = process.env.COACH_MODUS ?? "mock";
    if (m !== "mock" && m !== "uit") throw new Error(`COACH_MODUS "${m}" wordt nog niet ondersteund.`);
    return m;
  },
  /** Bewaartermijn van adviezen in het register, in maanden. */
  get bewaartermijnMaanden() {
    return getal("BEWAARTERMIJN_MAANDEN", 12);
  },
  /** Hoe lang een onafgemaakte wizard (inclusief chat) bewaard blijft, in dagen. */
  get conceptBewaardagen() {
    return getal("CONCEPT_BEWAARDAGEN", 30);
  },
};

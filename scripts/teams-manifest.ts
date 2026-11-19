/**
 * Vult het Teams-manifest in en controleert de spelregels van de opdracht:
 * alleen een persoonlijk tabblad (scope "personal"); geen bot, kanaal of groepschat.
 */
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMEIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export interface ManifestWaarden {
  VERSIE: string;
  TEAMS_APP_ID: string;
  ENTRA_CLIENT_ID: string;
  APP_DOMEIN: string;
}

export function vulManifest(sjabloon: string, w: ManifestWaarden): Record<string, unknown> {
  const fouten: string[] = [];
  if (!GUID.test(w.TEAMS_APP_ID)) fouten.push("TEAMS_APP_ID moet een GUID zijn.");
  if (!GUID.test(w.ENTRA_CLIENT_ID)) fouten.push("ENTRA_CLIENT_ID moet een GUID zijn.");
  if (!DOMEIN.test(w.APP_DOMEIN)) fouten.push("APP_DOMEIN moet een domeinnaam zijn, zonder https:// en zonder pad.");
  if (!/^\d+\.\d+\.\d+$/.test(w.VERSIE)) fouten.push("VERSIE moet de vorm 1.2.3 hebben.");
  if (fouten.length) throw new Error(fouten.join(" "));
  const tekst = sjabloon.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (w as unknown as Record<string, string>)[k] ?? `{{${k}}}`);
  const over = tekst.match(/\{\{\w+\}\}/g);
  if (over) throw new Error(`Niet ingevulde velden: ${over.join(", ")}`);
  return JSON.parse(tekst);
}

/** Geeft een lijst met overtredingen (leeg = in orde). */
export function controleerManifest(m: Record<string, unknown>): string[] {
  const fouten: string[] = [];
  for (const verboden of ["bots", "configurableTabs", "composeExtensions", "connectors", "meetingExtensionDefinition"]) {
    const waarde = m[verboden];
    if (Array.isArray(waarde) ? waarde.length > 0 : waarde !== undefined) fouten.push(`"${verboden}" is niet toegestaan.`);
  }
  const tabs = (m.staticTabs ?? []) as { scopes?: string[]; contentUrl?: string }[];
  if (tabs.length !== 1) fouten.push("Er moet precies één statisch tabblad zijn.");
  for (const t of tabs) {
    if (JSON.stringify(t.scopes) !== JSON.stringify(["personal"])) fouten.push('Het tabblad mag alleen scope "personal" hebben.');
    if (!t.contentUrl?.startsWith("https://")) fouten.push("contentUrl moet https gebruiken.");
  }
  const info = m.webApplicationInfo as { id?: string; resource?: string } | undefined;
  if (!info?.id || !info.resource?.startsWith("api://")) fouten.push("webApplicationInfo (voor Teams-SSO) ontbreekt of is onvolledig.");
  return fouten;
}

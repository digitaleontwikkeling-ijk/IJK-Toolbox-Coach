/** Teams-manifest: alleen een persoonlijk tabblad, en correct ingevuld. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { controleerManifest, vulManifest } from "../../scripts/teams-manifest";

const sjabloon = readFileSync(path.resolve(__dirname, "../../teams/manifest.template.json"), "utf8");
const waarden = {
  VERSIE: "0.1.0",
  TEAMS_APP_ID: "00000000-0000-4000-8000-000000000001",
  ENTRA_CLIENT_ID: "00000000-0000-4000-8000-000000000002",
  APP_DOMEIN: "coach.voorbeeld.invalid",
};

describe("Teams-manifest", () => {
  const m = vulManifest(sjabloon, waarden) as Record<string, any>;

  it("T1. het meegeleverde manifest voldoet aan de spelregels", () => {
    expect(controleerManifest(m)).toEqual([]);
  });

  it("T2. precies één tabblad, alleen scope personal; geen bot, kanaal of groepschat", () => {
    expect(m.staticTabs).toHaveLength(1);
    expect(m.staticTabs[0].scopes).toEqual(["personal"]);
    expect(m.bots).toBeUndefined();
    expect(m.configurableTabs).toBeUndefined();
    expect(m.composeExtensions).toBeUndefined();
  });

  it("T3. SSO-gegevens en domein zijn ingevuld", () => {
    expect(m.webApplicationInfo).toEqual({ id: waarden.ENTRA_CLIENT_ID, resource: `api://coach.voorbeeld.invalid/${waarden.ENTRA_CLIENT_ID}` });
    expect(m.validDomains).toEqual(["coach.voorbeeld.invalid"]);
    expect(m.staticTabs[0].contentUrl).toBe("https://coach.voorbeeld.invalid/login?inTeams=1");
  });

  it("T4. een bot, een kanaaltab of een extra scope wordt afgekeurd", () => {
    expect(controleerManifest({ ...m, bots: [{ botId: "x" }] })).toContain('"bots" is niet toegestaan.');
    expect(controleerManifest({ ...m, configurableTabs: [{}] })).toContain('"configurableTabs" is niet toegestaan.');
    const groep = { ...m, staticTabs: [{ ...m.staticTabs[0], scopes: ["personal", "team"] }] };
    expect(controleerManifest(groep)).toContain('Het tabblad mag alleen scope "personal" hebben.');
  });

  it("T5. ongeldige invoer wordt geweigerd", () => {
    expect(() => vulManifest(sjabloon, { ...waarden, APP_DOMEIN: "https://coach.ijk.nl/" })).toThrow(/domeinnaam/);
    expect(() => vulManifest(sjabloon, { ...waarden, ENTRA_CLIENT_ID: "abc" })).toThrow(/GUID/);
  });
});

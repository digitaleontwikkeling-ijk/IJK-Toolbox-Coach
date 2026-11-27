/** Beheer: mailsjablonen voor de licentieaanvraag (per tool, in de database, met audit-log). */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ANNA, BEHEERDER, leegDatabase, roep, type Handler } from "./hulp";
import { migreer } from "@/db/migreer";
import { db, sluitDb } from "@/db/pool";
import * as sjablonenRoute from "@/app/api/beheer/mailsjablonen/route";
import * as contentRoute from "@/app/api/content/route";

beforeAll(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  await migreer();
});
beforeEach(leegDatabase);
afterAll(sluitDb);

describe("mailsjablonen", () => {
  it("M1. alleen beheerders mogen ze lezen of wijzigen", async () => {
    expect((await roep(sjablonenRoute.GET as Handler, { gebruiker: ANNA })).status).toBe(403);
    expect((await roep(sjablonenRoute.PUT as Handler, { gebruiker: ANNA, method: "PUT", body: { tool: "claude_code", onderwerp: "x", tekst: "y" } })).status).toBe(403);
  });

  it("M2. beheerder past een sjabloon aan; de medewerker krijgt het via de content; terugzetten naar standaard", async () => {
    const voor = await roep(sjablonenRoute.GET as Handler, { gebruiker: BEHEERDER });
    expect(voor.json.sjablonen.claude_code.aangepast).toBe(false);

    const put = await roep(sjablonenRoute.PUT as Handler, {
      gebruiker: BEHEERDER, method: "PUT",
      body: { tool: "claude_code", onderwerp: "Licentie {tool} voor {naam}", tekst: "Hallo DO,\n\nGraag een {licentie}." },
    });
    expect(put.status).toBe(200);
    expect(put.json.sjablonen.claude_code).toEqual({ onderwerp: "Licentie {tool} voor {naam}", tekst: "Hallo DO,\n\nGraag een {licentie}.", aangepast: true });

    const c = await roep(contentRoute.GET as Handler, { gebruiker: ANNA });
    expect(c.json.mailsjablonen.claude_code.onderwerp).toBe("Licentie {tool} voor {naam}");
    expect(c.json.mailsjablonen.hubbi.aangepast).toBe(false);

    const audit = (await db().query("SELECT actie, rol FROM audit_log")).rows;
    expect(audit).toEqual([{ actie: "mailsjabloon_gewijzigd", rol: "beheerder" }]);

    const del = await roep(sjablonenRoute.DELETE as Handler, { gebruiker: BEHEERDER, method: "DELETE", body: { tool: "claude_code" } });
    expect(del.json.sjablonen.claude_code.aangepast).toBe(false);
    expect((await db().query("SELECT count(*)::int AS n FROM mailsjabloon")).rows[0].n).toBe(0);
  });

  it("M3. ongeldige invoer: lege tekst, of een tool zonder beheerder", async () => {
    const leeg = await roep(sjablonenRoute.PUT as Handler, { gebruiker: BEHEERDER, method: "PUT", body: { tool: "claude_code", onderwerp: "x", tekst: " " } });
    expect(leeg.status).toBe(400);
    const geenBeheer = await roep(sjablonenRoute.PUT as Handler, { gebruiker: BEHEERDER, method: "PUT", body: { tool: "azure_openai", onderwerp: "x", tekst: "y" } });
    expect(geenBeheer.status).toBe(400);
  });
});

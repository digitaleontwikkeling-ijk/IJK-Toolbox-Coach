/**
 * De coach-service valideert elk antwoord. Bij een ongeldig of ontbrekend antwoord
 * geeft hij null, zodat de wizard terugvalt op handmatig invullen.
 */
import { describe, expect, it, vi } from "vitest";
import type { CoachClient } from "@/coach/CoachClient";
import { MockCoachClient } from "@/coach/MockCoachClient";
import { CoachService } from "@/coach/service";
import { content } from "../helpers";

const ctx = { pseudoniemId: "abc" };
const vv = { beschrijving: "x", verduidelijking: [] };

function nep(antwoord: Partial<Record<keyof CoachClient, unknown>>): CoachClient {
  const f = (k: keyof CoachClient) => async () => {
    const a = antwoord[k];
    if (a instanceof Error) throw a;
    return a;
  };
  return { verduidelijk: f("verduidelijk"), tooladvies: f("tooladvies"), checksVoorinvullen: f("checksVoorinvullen"), uitleg: f("uitleg"), chat: f("chat") };
}

describe("coach: validatie en terugval", () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("K1. geldig tooladvies wordt doorgegeven", async () => {
    const s = new CoachService(nep({ tooladvies: { behoefte: "bouwen", tool: "claude_code", motivatie: "Past goed." } }), content);
    expect(await s.tooladvies({ ...vv, uitsluiten: [] }, ctx)).toEqual({ behoefte: "bouwen", tool: "claude_code", motivatie: "Past goed." });
  });

  it("K2. een tool die niet in de configuratie staat wordt geweigerd", async () => {
    const s = new CoachService(nep({ tooladvies: { behoefte: "bouwen", tool: "chatgpt_gratis", motivatie: "Handig." } }), content);
    expect(await s.tooladvies({ ...vv, uitsluiten: [] }, ctx)).toBeNull();
  });

  it("K3. een tool die de medewerker niet wilde wordt geweigerd", async () => {
    const s = new CoachService(nep({ tooladvies: { behoefte: "bouwen", tool: "claude_code", motivatie: "x" } }), content);
    expect(await s.tooladvies({ ...vv, uitsluiten: ["claude_code"] }, ctx)).toBeNull();
  });

  it("K4. meer dan twee verduidelijkende vragen wordt geweigerd", async () => {
    const s = new CoachService(nep({ verduidelijk: { vragen: ["a?", "b?", "c?"] } }), content);
    expect(await s.verduidelijk({ beschrijving: "x" }, ctx)).toBeNull();
  });

  it("K5. checks: waarden buiten de schaal en onbekende checks worden overgeslagen, de rest blijft", async () => {
    const s = new CoachService(
      nep({
        checksVoorinvullen: {
          checks: [
            { check: "data", voorstel: "intern", zekerheid: "hoog" },
            { check: "impact", voorstel: "apocalyptisch", zekerheid: "hoog" },
            { check: "budget", voorstel: "hoog", zekerheid: "hoog" },
            { check: "gebruikers", voorstel: "collegas", zekerheid: "onbekend" },
            { check: "data", voorstel: "openbaar", zekerheid: "laag" },
          ],
        },
      }),
      content,
    );
    expect(await s.checksVoorinvullen({ ...vv, tool: "hubbi" }, ctx)).toEqual([{ check: "data", voorstel: "intern", zekerheid: "hoog" }]);
  });

  it("K6. checks: een antwoord zonder lijst wordt geheel geweigerd", async () => {
    const s = new CoachService(nep({ checksVoorinvullen: "Ik denk groen!" }), content);
    expect(await s.checksVoorinvullen({ ...vv, tool: "hubbi" }, ctx)).toBeNull();
  });

  it("K7. een fout bij de coach geeft null", async () => {
    const s = new CoachService(nep({ uitleg: new Error("verbinding verbroken") }), content);
    expect(await s.uitleg({} as never, ctx)).toBeNull();
  });

  it("K8. de coach die te lang nadenkt geeft null (time-out)", async () => {
    const traag: CoachClient = { ...nep({}), chat: () => new Promise((r) => setTimeout(() => r({ antwoord: "laat" }), 200)) };
    const s = new CoachService(traag, content, 20);
    expect(await s.chat({ vraag: "?", stap: 1, beschrijving: "", geschiedenis: [] }, ctx)).toBeNull();
  });

  it("K9. zonder coach (modus uit) geeft elke taak null", async () => {
    const s = new CoachService(null, content);
    expect(s.beschikbaar).toBe(false);
    expect(await s.verduidelijk({ beschrijving: "x" }, ctx)).toBeNull();
    expect(await s.checksVoorinvullen({ ...vv, tool: "hubbi" }, ctx)).toBeNull();
  });

  it("K10. een leeg uitleg-antwoord wordt geweigerd", async () => {
    const s = new CoachService(nep({ uitleg: { uitleg: "   " } }), content);
    expect(await s.uitleg({} as never, ctx)).toBeNull();
  });

  it("K11. de mock-coach geeft altijd geldige antwoorden", async () => {
    const s = new CoachService(new MockCoachClient(content), content);
    const beschrijving = "HR-gegevens wekelijks automatisch in AFAS verwerken voor de afdeling";
    expect(await s.tooladvies({ beschrijving, verduidelijking: [], uitsluiten: [] }, ctx)).toMatchObject({ tool: "hubbi" });
    const checks = await s.checksVoorinvullen({ beschrijving, verduidelijking: [], tool: "hubbi" }, ctx);
    expect(checks).toHaveLength(6);
  });
});

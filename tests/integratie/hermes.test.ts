/**
 * HermesCoachClient tegen een nagebootste Hermes API-server (zelfde protocol).
 * Controleert: protocol en authenticatie, schema-validatie, terugval bij fouten
 * en dat er geen persoonsgegevens naar Hermes gaan.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HermesCoachClient, haalJsonUitTekst } from "@/coach/HermesCoachClient";
import { CoachService } from "@/coach/service";
import { evalueer } from "@/domain/beslisregels";
import { startHermesMock, type HermesMock } from "../../mocks/hermes-mock";
import { content, invoer, regelset } from "../helpers";

const SLEUTEL = "test-hermes-sleutel";
const ctx = { pseudoniemId: "3f2a9c0d1e2b4a5c6d7e8f9012345678" };
let mock: HermesMock;
let coach: CoachService;

function client(opties: Partial<{ apiKey: string; timeoutMs: number }> = {}) {
  return new HermesCoachClient(
    { apiUrl: mock.url, apiKey: opties.apiKey ?? SLEUTEL, model: "toolbox-coach", timeoutMs: opties.timeoutMs ?? 5000 },
    content,
  );
}

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  mock = await startHermesMock({ apiKey: SLEUTEL, content });
  coach = new CoachService(client(), content);
});
beforeEach(() => {
  mock.verzoeken.length = 0;
});
afterAll(() => mock.stop());

const vv = { verduidelijking: [] };

describe("protocol", () => {
  it("H1. stuurt een OpenAI-compatibel verzoek met Bearer-token en profielnaam als model", async () => {
    await coach.verduidelijk({ beschrijving: "Iets automatiseren" }, ctx);
    const v = mock.verzoeken[0]!;
    expect(v.taak).toBe("verduidelijk");
    expect(v.headers.authorization).toBe(`Bearer ${SLEUTEL}`);
    expect(v.body.model).toBe("toolbox-coach");
    expect(v.body.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(JSON.parse(v.body.messages[1]!.content).gebruiker).toBe(ctx.pseudoniemId);
  });

  it("H2. elke taak geeft via Hermes een geldig, gevalideerd antwoord", async () => {
    const beschrijving = "Wekelijks overzicht van openstaande facturen uit AFAS voor mijn team";
    expect(await coach.verduidelijk({ beschrijving }, ctx)).toEqual({ vragen: expect.any(Array) });
    expect(await coach.tooladvies({ beschrijving, ...vv, uitsluiten: [] }, ctx)).toMatchObject({ tool: "hubbi" });
    // 5 checks + Impact met 3 deelvragen (B, I, V)
    expect(await coach.checksVoorinvullen({ beschrijving, ...vv, tool: "hubbi" }, ctx)).toHaveLength(8);
    const uitkomst = evalueer(invoer({ checks: { systemen: "lezen", gebruikers: "collegas" } }), regelset);
    expect(await coach.uitleg({ beschrijving, tool: "hubbi", uitkomst, antwoorden: {} }, ctx)).toContain("Aan de slag met voorwaarden");
    expect(await coach.chat({ vraag: "Wat mag ik met HubBI?", stap: 2, beschrijving, geschiedenis: [] }, ctx)).toContain("HubBI");
  });

  it("H3. een JSON-antwoord in een codeblok wordt toch gelezen", async () => {
    expect(await coach.tooladvies({ beschrijving: "Een dashboard bouwen #codeblok", ...vv, uitsluiten: [] }, ctx)).toMatchObject({ tool: "claude_code" });
  });

  it("H4. de instructies bevatten de tools en schalen uit de content (niet hardcoded)", async () => {
    await coach.checksVoorinvullen({ beschrijving: "x", ...vv, tool: "hubbi" }, ctx);
    const systeem = mock.verzoeken[0]!.body.messages[0]!.content;
    for (const c of regelset.checks) for (const a of c.antwoorden) expect(systeem).toContain(a.id);
    expect(systeem).toContain("NOOIT zelf de risicokleur");
  });
});

describe("terugval: ongeldig of geen antwoord → null (handmatig invullen)", () => {
  it("H5. verkeerde sleutel (401)", async () => {
    const s = new CoachService(client({ apiKey: "fout" }), content);
    expect(await s.verduidelijk({ beschrijving: "x" }, ctx)).toBeNull();
  });

  it.each([
    ["serverfout (500)", "#hermes-fout"],
    ["te druk (429)", "#hermes-druk"],
    ["geen JSON", "#geen-json"],
    ["afgebroken turn (finish_reason error)", "#afgebroken"],
    ["tool die niet in de toolbox staat", "#verkeerde-tool"],
  ])("H6. tooladvies bij %s", async (_naam, trigger) => {
    expect(await coach.tooladvies({ beschrijving: `Iets bouwen ${trigger}`, ...vv, uitsluiten: [] }, ctx)).toBeNull();
  });

  it("H7. checks met waarden buiten de schaal worden allemaal overgeslagen", async () => {
    expect(await coach.checksVoorinvullen({ beschrijving: "x #ongeldige-checks", ...vv, tool: "hubbi" }, ctx)).toEqual([]);
  });

  it("H8. een uitleg die een andere uitkomst noemt dan berekend wordt geweigerd", async () => {
    const uitkomst = evalueer(invoer({ rodeVlaggen: { open_zonder_toetsing: true } }), regelset);
    expect(await coach.uitleg({ beschrijving: "x #andere-uitkomst", tool: "hubbi", uitkomst, antwoorden: {} }, ctx)).toBeNull();
  });

  it("H9. time-out: Hermes reageert te traag", async () => {
    const s = new CoachService(client({ timeoutMs: 300 }), content);
    expect(await s.verduidelijk({ beschrijving: "x #traag" }, ctx)).toBeNull();
  });

  it("H10. Hermes onbereikbaar", async () => {
    const weg = new HermesCoachClient({ apiUrl: "http://127.0.0.1:1/v1", apiKey: SLEUTEL, model: "toolbox-coach", timeoutMs: 1000 }, content);
    expect(await new CoachService(weg, content).verduidelijk({ beschrijving: "x" }, ctx)).toBeNull();
  });
});

describe("privacy", () => {
  it("H11. e-mailadressen, telefoonnummers en IBAN's gaan niet naar Hermes", async () => {
    await coach.chat(
      {
        vraag: "Mail jan.jansen@ijk.nl of bel 06-12345678, IBAN NL91ABNA0417164300",
        stap: 1,
        beschrijving: "Contact: piet@voorbeeld.nl",
        geschiedenis: [{ rol: "medewerker", tekst: "mijn nummer is +31 6 12345678" }],
      },
      ctx,
    );
    const verstuurd = JSON.stringify(mock.verzoeken[0]!.body);
    for (const geheim of ["jan.jansen@ijk.nl", "06-12345678", "6 12345678", "NL91ABNA", "piet@voorbeeld.nl"]) expect(verstuurd).not.toContain(geheim);
    expect(verstuurd).toContain("[e-mailadres verwijderd]");
  });

  it("H12. het verzoek bevat alleen het pseudoniem, geen naam", async () => {
    await coach.verduidelijk({ beschrijving: "x" }, ctx);
    const gebruiker = JSON.parse(mock.verzoeken[0]!.body.messages[1]!.content);
    expect(Object.keys(gebruiker).sort()).toEqual(["beschrijving", "gebruiker"]);
  });
});

describe("JSON uit tekst halen", () => {
  it("H13. haalt JSON uit tekst met ruis eromheen en weigert kapotte JSON", () => {
    expect(haalJsonUitTekst('Hier: {"a": 1} klaar')).toEqual({ a: 1 });
    expect(() => haalJsonUitTekst("{kapot")).toThrow();
    expect(() => haalJsonUitTekst("geen json")).toThrow();
  });
});

/**
 * Regelset 0.7: een tool die (nog) niet in de IJK Toolbox zit.
 * De checks gelden gewoon; de uitkomst is minstens oranje en beide toetsers kijken mee.
 */
import { describe, expect, it } from "vitest";
import { evalueer } from "@/domain/beslisregels";
import { regelsetSchema, toolsSchema, ANDERE_TOOL } from "@/domain/content-schema";
import { beslisInvoerUit, toolGekozen } from "@/domain/invoer";
import { geldigeLink, wizardDataSchema } from "@/domain/wizard";
import { content, invoer } from "../helpers";

const { regelset } = content;
const BEIDE = ["toetser_compliance", "toetser_architect"];
const buiten = (opties: Parameters<typeof invoer>[0] = {}) => ({ ...invoer(opties), toolBuitenToolbox: true });

describe("tool buiten de IJK Toolbox", () => {
  it("T1. verder geel → oranje, met beide toetsers", () => {
    const u = evalueer(buiten({ checks: { systemen: "lezen" } }), regelset);
    expect(evalueer(invoer({ checks: { systemen: "lezen" } }), regelset).kleur).toBe("geel");
    expect(u.kleur).toBe("oranje");
    expect(u.toetsers).toEqual(BEIDE);
    expect(u.voorwaarden).toEqual([]);
  });

  it("T2. oranje op een check van één toetser → toch beide toetsers; de motivatie noemt de check, niet de tool", () => {
    const u = evalueer(buiten({ checks: { systemen: "koppelen" } }), regelset);
    expect(evalueer(invoer({ checks: { systemen: "koppelen" } }), regelset).toetsers).toEqual(["toetser_architect"]);
    expect(u.kleur).toBe("oranje");
    expect(u.toetsers).toEqual(BEIDE);
    expect(u.redenen.some((r) => r.soort === "signaal")).toBe(false);
  });

  it("T3. rood blijft rood (de checks en aanvullende vragen gelden gewoon)", () => {
    const u = evalueer(buiten({ checks: { impact: "groot" } }), regelset);
    expect(u.kleur).toBe("rood");
    const v = evalueer(buiten({ rodeVlaggen: { open_zonder_toetsing: true } }), regelset);
    expect(v.kleur).toBe("rood");
    expect(v.alternatieven).toEqual(["Eerst toetsen, dan pas delen."]);
  });

  it("T4. samen met een AI Act-signaal: beide redenen in de motivatie", () => {
    const u = evalueer(buiten({ checks: { autonomie: "adviseren" }, extraVragen: { advies_over_mensen: true } }), regelset);
    expect(u.kleur).toBe("oranje");
    expect(u.redenen.filter((r) => r.soort === "signaal").map((r) => r.soort === "signaal" && r.signaal)).toEqual([
      "tool_buiten_toolbox",
      "ai_act",
    ]);
  });

  it("T5. zonder het kenmerk verandert er niets (toolBuitenToolbox ontbreekt of is false)", () => {
    expect(evalueer(invoer(), regelset).kleur).toBe("groen");
    expect(evalueer({ ...invoer(), toolBuitenToolbox: false }, regelset).kleur).toBe("groen");
  });

  it("T6. beslisInvoerUit zet het kenmerk alleen bij de andere tool", () => {
    const basis = wizardDataSchema.parse({ checks: invoer().checks, rodeVlaggen: invoer().rodeVlaggen });
    const andere = { ...basis, tooladvies: { tool: ANDERE_TOOL, bron: "medewerker" as const, motivatie: "", geaccepteerd: true, andereTool: { naam: "Notion", link: "" } } };
    expect(beslisInvoerUit(andere, content).toolBuitenToolbox).toBe(true);
    expect(beslisInvoerUit({ ...andere, tooladvies: { ...andere.tooladvies, tool: "hubbi" } }, content).toolBuitenToolbox).toBe(false);
  });

  it("T7. toolGekozen: naam verplicht, link optioneel maar alleen http(s)", () => {
    const met = (andereTool: { naam: string; link: string }) =>
      toolGekozen(wizardDataSchema.parse({ tooladvies: { tool: ANDERE_TOOL, bron: "medewerker", andereTool } }), content);
    expect(met({ naam: "Notion", link: "" })).toBe(true);
    expect(met({ naam: "Notion", link: "https://www.notion.so" })).toBe(true);
    expect(met({ naam: "  ", link: "" })).toBe(false);
    expect(met({ naam: "Notion", link: "javascript:alert(1)" })).toBe(false);
    expect(geldigeLink("www.notion.so")).toBe(false);
    expect(toolGekozen(wizardDataSchema.parse({ tooladvies: { tool: "onbekend", bron: "medewerker" } }), content)).toBe(false);
  });

  it("T8. content: het id van de andere tool is gereserveerd; onbekende toetser of kleur wordt geweigerd", () => {
    const tools = { ...content.tools, tools: [...content.tools.tools, { id: ANDERE_TOOL, naam: "X", spelregels: "x" }] };
    expect(toolsSchema.safeParse(tools).success).toBe(false);
    const fout = (tb: object) => regelsetSchema.safeParse({ ...regelset, tool_buiten_toolbox: { ...regelset.tool_buiten_toolbox, ...tb } }).success;
    expect(fout({ toetsers: ["onbekend"] })).toBe(false);
    expect(fout({ minimale_uitkomst: "paars" })).toBe(false);
  });
});

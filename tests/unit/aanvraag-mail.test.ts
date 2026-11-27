/** E-mail voor een licentieaanvraag (mailto naar de beheerder van de tool) en de mailsjablonen. */
import { describe, expect, it } from "vitest";
import { aanvraagMailto } from "@/lib/aanvraagMail";
import { licentieNaam, mailsjablonen, standaardSjabloon } from "@/domain/mailsjablonen";
import { content } from "../helpers";

const basis = {
  aan: "ict@driessengroep.nl",
  tool: "Copilot workflows",
  licentie: licentieNaam(content.tools, "copilot_workflows"),
  naam: "Anna de Vries",
  referentie: "TC-2026-0002",
  uitkomst: "Aan de slag met voorwaarden",
  voorwaarden: ["Alleen testdata gebruiken."],
  link: "https://coach.test/advies/1",
};

describe("aanvraagmail met het standaardsjabloon", () => {
  const m = aanvraagMailto({ ...basis, ...standaardSjabloon(content.teksten) });
  const u = new URL(m);
  it("aan de beheerder, onderwerp 'Aanvraag licentie <tool> - <naam>'", () => {
    expect(m.startsWith("mailto:ict@driessengroep.nl?subject=")).toBe(true);
    expect(u.searchParams.get("subject")).toBe("Aanvraag licentie Copilot workflows - Anna de Vries");
  });
  it("de tekst van IJK, met de naam van de licentie en de naam van de aanvrager", () => {
    expect(u.searchParams.get("body")).toBe(
      "Hallo collega's,\r\n\r\nVia deze mail wil ik graag een licentie aanvragen voor de Copilot for MS365 licentie.\r\n\r\nMet vriendelijke groet,\r\n\r\nAnna de Vries",
    );
  });
  it("spaties als %20 en regels als CRLF (goed voor Outlook)", () => {
    expect(m).not.toContain("+");
    expect(m).toContain("%0D%0A");
  });
});

describe("mailsjablonen", () => {
  it("per tool met een beheerder: het eigen sjabloon of de standaard", () => {
    const s = mailsjablonen(content.tools, content.teksten, { claude_code: { onderwerp: "Eigen {tool}", tekst: "Ref {referentie}" } });
    expect(s.claude_code).toEqual({ onderwerp: "Eigen {tool}", tekst: "Ref {referentie}", aangepast: true });
    expect(s.hubbi).toMatchObject({ ...standaardSjabloon(content.teksten), aangepast: false });
    expect(s.azure_openai).toBeUndefined(); // geen beheerder
  });
  it("alle velden worden ingevuld", () => {
    const m = aanvraagMailto({ ...basis, onderwerp: "{tool}", tekst: "{referentie} {uitkomst} {link} {licentie}\n{voorwaarden}" });
    expect(new URL(m).searchParams.get("body")).toBe("TC-2026-0002 Aan de slag met voorwaarden https://coach.test/advies/1 Copilot for MS365 licentie\r\n- Alleen testdata gebruiken.");
  });
  it("naam van de licentie: uit tools.yaml, anders '<tool>-licentie'", () => {
    expect(licentieNaam(content.tools, "claude_code")).toBe("Claude Code-licentie");
    expect(licentieNaam(content.tools, "azure_openai")).toBe("Azure OpenAI-licentie");
  });
});

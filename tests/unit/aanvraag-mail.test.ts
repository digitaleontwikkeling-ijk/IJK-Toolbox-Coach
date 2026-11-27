/** E-mail voor een licentieaanvraag (mailto naar de beheerder van de tool). */
import { describe, expect, it } from "vitest";
import { aanvraagMailto } from "@/lib/aanvraagMail";
import { content } from "../helpers";

describe("aanvraagmail", () => {
  const m = aanvraagMailto({
    aan: "digitaleontwikkeling@ijk.nl",
    tool: "Claude Code",
    naam: "Anna de Vries",
    referentie: "TC-2026-0001",
    uitkomst: "Aan de slag met voorwaarden",
    voorwaarden: ["Alleen testdata gebruiken."],
    link: "https://coach.test/advies/1",
    onderwerp: content.teksten.aanvraag_mail.onderwerp,
    tekst: content.teksten.aanvraag_mail.tekst,
  });
  it("aan de beheerder, met het onderwerp 'Aanvraag licentie <tool> - <naam>'", () => {
    expect(m.startsWith("mailto:digitaleontwikkeling@ijk.nl?subject=")).toBe(true);
    const u = new URL(m);
    expect(u.searchParams.get("subject")).toBe("Aanvraag licentie Claude Code - Anna de Vries");
    const tekst = u.searchParams.get("body")!;
    for (const deel of ["TC-2026-0001", "Aan de slag met voorwaarden", "- Alleen testdata gebruiken.", "https://coach.test/advies/1"]) {
      expect(tekst).toContain(deel);
    }
  });
  it("spaties als %20 en regels als CRLF (goed voor Outlook)", () => {
    expect(m).not.toContain("+");
    expect(m).toContain("%0D%0A");
  });
});

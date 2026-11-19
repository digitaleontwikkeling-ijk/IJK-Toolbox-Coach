import { describe, expect, it } from "vitest";
import { verwijderContactgegevens } from "@/coach/privacy";

describe("verwijderContactgegevens", () => {
  it.each([
    ["mail a.b@c.nl nu", "mail [e-mailadres verwijderd] nu"],
    ["bel 0612345678", "bel [telefoonnummer verwijderd]"],
    ["bel +31 20 123 4567", "bel [telefoonnummer verwijderd]"],
    ["IBAN NL91 ABNA 0417 1643 00", "IBAN [IBAN verwijderd]"],
    ["bsn 123456782", "bsn [nummer verwijderd]"],
  ])("%s", (in_, uit) => expect(verwijderContactgegevens(in_)).toBe(uit));

  it("laat gewone tekst en korte getallen staan", () => {
    const t = "Wekelijks overzicht van 25 facturen uit AFAS in 2026";
    expect(verwijderContactgegevens(t)).toBe(t);
  });
});

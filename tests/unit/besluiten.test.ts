import { describe, expect, it } from "vitest";
import { eindstatus } from "@/domain/besluiten";

const C = "toetser_compliance";
const A = "toetser_architect";

describe("eindstatus na besluiten van toetsers", () => {
  it("B1. nog niet alle toetsers besloten → geen eindstatus", () => {
    expect(eindstatus([C, A], [{ toetserRol: C, besluit: "goedgekeurd" }])).toBeNull();
  });
  it("B2. één toetser, goedgekeurd → goedgekeurd", () => {
    expect(eindstatus([A], [{ toetserRol: A, besluit: "goedgekeurd" }])).toBe("goedgekeurd");
  });
  it("B3. beide goedgekeurd → goedgekeurd", () => {
    expect(eindstatus([C, A], [{ toetserRol: C, besluit: "goedgekeurd" }, { toetserRol: A, besluit: "goedgekeurd" }])).toBe("goedgekeurd");
  });
  it("B4. één met voorwaarden → goedgekeurd met voorwaarden", () => {
    expect(
      eindstatus([C, A], [{ toetserRol: C, besluit: "goedgekeurd_met_voorwaarden" }, { toetserRol: A, besluit: "goedgekeurd" }]),
    ).toBe("goedgekeurd_met_voorwaarden");
  });
  it("B5. één afwijzing wint altijd", () => {
    expect(
      eindstatus([C, A], [{ toetserRol: C, besluit: "goedgekeurd_met_voorwaarden" }, { toetserRol: A, besluit: "afgewezen" }]),
    ).toBe("afgewezen");
  });
  it("B6. besluit van een niet-toegewezen toetser telt niet mee", () => {
    expect(eindstatus([C], [{ toetserRol: A, besluit: "afgewezen" }])).toBeNull();
    expect(eindstatus([C], [{ toetserRol: A, besluit: "afgewezen" }, { toetserRol: C, besluit: "goedgekeurd" }])).toBe("goedgekeurd");
  });
  it("B7. zonder toetsers geen eindstatus", () => {
    expect(eindstatus([], [])).toBeNull();
  });
});

/** Logo's van tools: worden als data-URI ingeladen; een ontbrekend of te groot bestand stopt het laden. */
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ContentFout, laadContent } from "@/content/laad-content";

const BRON = path.resolve(__dirname, "../../content");

function kopie(aanpassen: (map: string) => void): string {
  const map = mkdtempSync(path.join(tmpdir(), "content-"));
  cpSync(BRON, map, { recursive: true });
  aanpassen(map);
  return map;
}

describe("iconen", () => {
  it("IC1. elke tool heeft een logo, ingeladen als PNG-data-URI", () => {
    const c = laadContent(BRON);
    expect(Object.keys(c.iconen).sort()).toEqual(c.tools.tools.map((t) => t.id).sort());
    for (const uri of Object.values(c.iconen)) expect(uri).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  });

  it("IC2. ontbrekend of te groot bestand → duidelijke fout", () => {
    expect(() => laadContent(kopie((m) => rmSync(path.join(m, "iconen", "hubbi.png"))))).toThrow(ContentFout);
    expect(() => laadContent(kopie((m) => writeFileSync(path.join(m, "iconen", "hubbi.png"), Buffer.alloc(300 * 1024))))).toThrow(
      /groter dan 200 kB/,
    );
  });
});

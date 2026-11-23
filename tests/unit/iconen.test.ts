/** Logo's van tools: worden als data-URI ingeladen; een ontbrekend of te groot bestand stopt het laden. */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ContentFout, laadContent } from "@/content/laad-content";

const BRON = path.resolve(__dirname, "../../content");
// Kleinste geldige PNG (1×1, transparant).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

function kopieMetIcoon(bestand: Buffer | null): string {
  const map = mkdtempSync(path.join(tmpdir(), "content-"));
  cpSync(BRON, map, { recursive: true });
  const tools = readFileSync(path.join(map, "tools.yaml"), "utf8").replace(
    "    naam: HubBI\n",
    "    naam: HubBI\n    icoon: iconen/hubbi.png\n",
  );
  writeFileSync(path.join(map, "tools.yaml"), tools);
  if (bestand) writeFileSync(path.join(map, "iconen", "hubbi.png"), bestand);
  return map;
}

describe("iconen", () => {
  it("IC1. een icoon wordt als data-URI ingeladen; tools zonder icoon krijgen er geen", () => {
    const c = laadContent(kopieMetIcoon(PNG));
    expect(c.iconen.hubbi).toBe(`data:image/png;base64,${PNG.toString("base64")}`);
    expect(Object.keys(c.iconen)).toEqual(["hubbi"]);
  });

  it("IC2. ontbrekend of te groot bestand → duidelijke fout", () => {
    expect(() => laadContent(kopieMetIcoon(null))).toThrow(ContentFout);
    expect(() => laadContent(kopieMetIcoon(Buffer.alloc(300 * 1024)))).toThrow(/groter dan 200 kB/);
  });
});

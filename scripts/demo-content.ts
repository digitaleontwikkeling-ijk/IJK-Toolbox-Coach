/** Zet de (gecontroleerde) content als JSON klaar voor de statische demo. */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { laadContent } from "../src/content/laad-content";

const c = laadContent(path.resolve(import.meta.dirname, "..", "content"));
writeFileSync(path.resolve(import.meta.dirname, "..", "src", "demo", "content.generated.json"), JSON.stringify(c));
console.log(`Demo-content klaargezet (regelset ${c.regelset.versie}, tools ${c.tools.versie}).`);

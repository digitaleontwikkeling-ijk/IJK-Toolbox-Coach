/**
 * Leest en valideert de content-bestanden uit `content/`.
 * Een fout in de content stopt het opstarten, met een duidelijke melding.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { ZodTypeAny, z } from "zod";
import {
  regelsetSchema,
  spelregelsSchema,
  toolsSchema,
  type Regelset,
  tekstenSchema,
  type Spelregels,
  type Teksten,
  type ToolsConfig,
} from "../domain/content-schema";

export interface Content {
  regelset: Regelset;
  tools: ToolsConfig;
  /** tool-id → spelregels */
  spelregels: Record<string, Spelregels>;
  teksten: Teksten;
  /** tool-id → logo als data-URI (alleen tools met een icoon). */
  iconen: Record<string, string>;
}

const MAX_ICOON_BYTES = 200 * 1024;
const MIME: Record<string, string> = { png: "image/png", svg: "image/svg+xml", webp: "image/webp" };

/** Leest een logo en geeft het als data-URI (werkt zo ook in de statische demo, zonder aparte bestanden). */
function leesIcoon(map: string, bestand: string): string {
  let data: Buffer;
  try {
    data = readFileSync(path.join(map, bestand));
  } catch (e) {
    throw new ContentFout(bestand, [(e as Error).message]);
  }
  if (data.length > MAX_ICOON_BYTES) throw new ContentFout(bestand, [`icoon is groter dan ${MAX_ICOON_BYTES / 1024} kB`]);
  const ext = bestand.split(".").pop()!;
  return `data:${MIME[ext]};base64,${data.toString("base64")}`;
}

export class ContentFout extends Error {
  constructor(bestand: string, details: string[]) {
    super(`Fout in content-bestand ${bestand}:\n- ${details.join("\n- ")}`);
    this.name = "ContentFout";
  }
}

export function standaardContentMap(): string {
  return process.env.CONTENT_DIR ?? path.resolve(process.cwd(), "content");
}

function leesYaml<S extends ZodTypeAny>(map: string, bestand: string, schema: S): z.output<S> {
  const volledig = path.join(map, bestand);
  let ruw: unknown;
  try {
    ruw = parse(readFileSync(volledig, "utf8"));
  } catch (e) {
    throw new ContentFout(bestand, [(e as Error).message]);
  }
  const resultaat = schema.safeParse(ruw);
  if (!resultaat.success) {
    throw new ContentFout(
      bestand,
      resultaat.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)),
    );
  }
  return resultaat.data;
}

export function laadContent(map: string = standaardContentMap()): Content {
  const regelset = leesYaml(map, "regelset.yaml", regelsetSchema);
  const tools = leesYaml(map, "tools.yaml", toolsSchema);
  const spelregels: Record<string, Spelregels> = {};
  for (const tool of tools.tools) {
    const s = leesYaml(map, tool.spelregels, spelregelsSchema);
    if (s.tool !== tool.id) {
      throw new ContentFout(tool.spelregels, [`verwacht tool "${tool.id}", gevonden "${s.tool}"`]);
    }
    spelregels[tool.id] = s;
  }
  const teksten = leesYaml(map, "teksten.yaml", tekstenSchema);
  const iconen: Record<string, string> = {};
  for (const tool of tools.tools) if (tool.icoon) iconen[tool.id] = leesIcoon(map, tool.icoon);
  return { regelset, tools, spelregels, teksten, iconen };
}

let cache: Content | undefined;
/** Content één keer laden en daarna hergebruiken (voor de server). */
export function content(): Content {
  cache ??= laadContent();
  return cache;
}

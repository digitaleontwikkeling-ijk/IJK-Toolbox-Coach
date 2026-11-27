/**
 * Tooladvies van de oefencoach (zonder AI), volledig op basis van de beheerde adviesregels. Hermes leest de teksten
 * van de regels; de oefencoach gebruikt de trefwoorden en de structuur (voorkeur, uitsluiting, combinatie).
 * Zo werkt een wijziging van een beheerder ook in de demo en de tests direct door.
 *
 * Werkwijze:
 * 1. Score per tool: het aantal trefwoorden uit de actieve toepassingsregels dat in de beschrijving voorkomt.
 * 2. Uitsluiting: "nooit als hoofdtool", of een uitsluiting waarvan een trefwoord voorkomt → geen hoofdtool.
 * 3. Voorkeur (op prioriteit, 1 eerst): geldt de regel (een trefwoord komt voor, of de regel heeft geen trefwoorden)
 *    en scoren beide tools, dan komt de tool uit "boven" lager uit dan deze tool. Een tegenstrijdige voorkeur met een
 *    hogere prioriteit wordt overgeslagen.
 * 4. Hoofdtool: de hoogste score (gelijk: de volgorde in tools.yaml). Niets herkend: de eerste toegestane tool.
 * 5. Aanvullend: combinatieregels bij de hoofdtool die gelden (geen trefwoorden = altijd), maximaal twee.
 */
import type { Adviesregel } from "../domain/adviesregels";
import type { ToolsConfig } from "../domain/content-schema";

export interface OefenAdvies {
  behoefte: string;
  doel: string;
  tool: string;
  rol: string;
  motivatie: string;
  aanvullend: { tool: string; rol: string }[];
  alternatieven: { tool: string; waarom_niet: string }[];
}

/** Komt het trefwoord voor? Korte woorden (3 tekens of minder) alleen als heel woord. */
export function komtVoor(tekst: string, woord: string): boolean {
  const t = tekst.toLowerCase();
  const w = woord.toLowerCase();
  if (w.length > 3) return t.includes(w);
  return new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(t);
}

const eersteZin = (s: string) => (s.split(/(?<=[.!?])\s/)[0] ?? s).trim();
const kleineLetter = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function oefenToolkeuze(tekst: string, regels: Adviesregel[], tools: ToolsConfig, uitsluiten: string[]): OefenAdvies | null {
  const actief = regels.filter((r) => r.actief);
  const naam = (id: string) => tools.tools.find((t) => t.id === id)?.naam ?? id;
  const geldt = (r: Adviesregel) => r.trefwoorden.length === 0 || r.trefwoorden.some((w) => komtVoor(tekst, w));

  // 1. Score per tool
  const score = new Map<string, number>();
  const herkend = new Map<string, string[]>();
  for (const t of tools.tools) {
    const woorden = [...new Set(actief.filter((r) => r.tool === t.id && r.soort === "toepassing").flatMap((r) => r.trefwoorden))].filter((w) => komtVoor(tekst, w));
    score.set(t.id, woorden.length);
    herkend.set(t.id, woorden);
  }

  // 2. Uitsluiting
  const waaromNiet = new Map<string, string>();
  const uitgesloten = new Set(uitsluiten);
  for (const r of actief.filter((x) => x.soort === "uitsluiting" && x.tool !== "algemeen")) {
    if (r.nooit_hoofdtool || (r.trefwoorden.length > 0 && geldt(r))) {
      uitgesloten.add(r.tool);
      if ((score.get(r.tool) ?? 0) > 0) waaromNiet.set(r.tool, eersteZin(r.tekst));
    }
  }

  // 3. Voorkeur
  const toegepast: Adviesregel[] = [];
  const voorkeuren = actief.filter((r) => r.soort === "voorkeur").sort((a, b) => a.prioriteit - b.prioriteit);
  for (const r of voorkeuren) {
    if (!geldt(r)) continue;
    if (toegepast.some((eerder) => eerder.boven.includes(r.tool) && r.boven.includes(eerder.tool))) continue; // zwaardere regel won al
    const eigen = score.get(r.tool) ?? 0;
    if (eigen === 0) continue;
    let werkte = false;
    for (const ander of r.boven) {
      const s = score.get(ander) ?? 0;
      if (s > 0 && s >= eigen) {
        score.set(ander, eigen - 0.5);
        werkte = true;
      }
      if (s > 0) waaromNiet.set(ander, waaromNiet.get(ander) ?? `${naam(r.tool)} gaat hier vóór ${naam(ander)}: ${kleineLetter(r.titel)}.`);
    }
    if (werkte || r.boven.some((x) => (score.get(x) ?? 0) > 0)) toegepast.push(r);
  }

  // 4. Hoofdtool
  const kandidaten = tools.tools.filter((t) => !uitgesloten.has(t.id));
  if (kandidaten.length === 0) return null;
  const beste = [...kandidaten].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))[0]!;
  const hoofdtool = beste.id;

  // 5. Aanvullend
  const aanvullend = actief
    .filter((r) => r.soort === "combinatie" && r.bij.includes(hoofdtool) && r.tool !== hoofdtool && geldt(r))
    .sort((a, b) => a.prioriteit - b.prioriteit)
    .filter((r, i, lijst) => lijst.findIndex((x) => x.tool === r.tool) === i)
    .slice(0, 2)
    .map((r) => ({ tool: r.tool, rol: r.tekst }));

  // Teksten
  const beschrijving = actief.find((r) => r.tool === hoofdtool && r.soort === "beschrijving");
  const toolInfo = tools.tools.find((t) => t.id === hoofdtool)!;
  const behoefte =
    tools.behoeften.find((b) => b.tools[0] === hoofdtool) ?? tools.behoeften.find((b) => b.tools.includes(hoofdtool)) ?? tools.behoeften[0]!;
  const woorden = herkend.get(hoofdtool) ?? [];
  const regel = toegepast.find((r) => r.tool === hoofdtool) ?? actief.find((r) => r.tool === hoofdtool && r.soort === "algemeen");
  const motivatie = [
    woorden.length ? `In je beschrijving herken ik: ${woorden.slice(0, 4).join(", ")}.` : "Ik herken in je beschrijving geen duidelijke toepassing; kijk dus goed of dit klopt.",
    regel ? eersteZin(regel.tekst) : beschrijving ? eersteZin(beschrijving.tekst) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const alternatieven = tools.tools
    .filter((t) => t.id !== hoofdtool && !aanvullend.some((a) => a.tool === t.id) && (herkend.get(t.id)?.length ?? 0) > 0)
    .sort((a, b) => (herkend.get(b.id)?.length ?? 0) - (herkend.get(a.id)?.length ?? 0))
    .slice(0, 2)
    .map((t) => ({ tool: t.id, waarom_niet: waaromNiet.get(t.id) ?? `${naam(hoofdtool)} past beter bij wat je beschrijft.` }));

  return {
    behoefte: behoefte.id,
    doel: `Je wilt: ${kleineLetter(behoefte.omschrijving)}.`,
    tool: hoofdtool,
    rol: beschrijving ? eersteZin(beschrijving.tekst) : toolInfo.rol,
    motivatie,
    aanvullend,
    alternatieven,
  };
}

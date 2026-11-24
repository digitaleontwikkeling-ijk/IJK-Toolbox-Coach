/**
 * Van wizardgegevens naar de invoer voor de beslisregels (pure functies; ook gebruikt door de demo).
 */
import { extraVraagVanToepassing, rodeVlagVanToepassing, type BeslisInvoer } from "./beslisregels";
import { analyseer } from "./verdieping";
import { ANDERE_TOOL, type Regelset, type ToolsConfig } from "./content-schema";
import { geldigeLink, type WizardData } from "./wizard";

export function beslisInvoerUit(data: WizardData, content: { regelset: Regelset }): BeslisInvoer {
  const invoer: BeslisInvoer = {
    checks: data.checks,
    rodeVlaggen: data.rodeVlaggen,
    extraVragen: {},
    verdieping: {},
    toolBuitenToolbox: data.tooladvies?.tool === ANDERE_TOOL,
  };
  // Alleen extra vragen die bij de gekozen antwoorden horen tellen mee.
  for (const e of content.regelset.extra_vragen) {
    if (extraVraagVanToepassing(e.id, invoer, content.regelset) && e.id in data.extraVragen) {
      invoer.extraVragen![e.id] = data.extraVragen[e.id]!;
    }
  }
  // Alleen verdiepingsvragen die nu relevant zijn (en niet afgeleid) tellen mee; oude antwoorden niet.
  const analyse = analyseer({ ...invoer, verdieping: data.verdieping }, content.regelset);
  for (const v of analyse.vragen) if (v.antwoord !== undefined) invoer.verdieping![v.gegeven.id] = v.antwoord;
  // Aanvullende vragen die niet gesteld worden, tellen niet mee.
  invoer.rodeVlaggen = Object.fromEntries(
    Object.entries(data.rodeVlaggen).filter(([id]) => rodeVlagVanToepassing(id, invoer, content.regelset)),
  );
  return invoer;
}

/** Is er een geldige tool gekozen: een tool uit de toolbox, of een andere tool met een naam? */
export function toolGekozen(data: WizardData, content: { tools: ToolsConfig }): boolean {
  const t = data.tooladvies;
  if (!t) return false;
  if (t.tool === ANDERE_TOOL) return !!t.andereTool?.naam.trim() && geldigeLink(t.andereTool.link);
  return content.tools.tools.some((x) => x.id === t.tool);
}

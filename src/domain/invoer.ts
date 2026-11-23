/**
 * Van wizardgegevens naar de invoer voor de beslisregels (pure functies; ook gebruikt door de demo).
 */
import { extraVraagVanToepassing, type BeslisInvoer } from "./beslisregels";
import { ANDERE_TOOL, type Regelset, type ToolsConfig } from "./content-schema";
import { geldigeLink, type WizardData } from "./wizard";

export function beslisInvoerUit(data: WizardData, content: { regelset: Regelset }): BeslisInvoer {
  const invoer: BeslisInvoer = {
    checks: data.checks,
    rodeVlaggen: data.rodeVlaggen,
    extraVragen: {},
    toolBuitenToolbox: data.tooladvies?.tool === ANDERE_TOOL,
  };
  // Alleen extra vragen die bij de gekozen antwoorden horen tellen mee.
  for (const e of content.regelset.extra_vragen) {
    if (extraVraagVanToepassing(e.id, invoer, content.regelset) && e.id in data.extraVragen) {
      invoer.extraVragen![e.id] = data.extraVragen[e.id]!;
    }
  }
  return invoer;
}

/** Is er een geldige tool gekozen: een tool uit de toolbox, of een andere tool met een naam? */
export function toolGekozen(data: WizardData, content: { tools: ToolsConfig }): boolean {
  const t = data.tooladvies;
  if (!t) return false;
  if (t.tool === ANDERE_TOOL) return !!t.andereTool?.naam.trim() && geldigeLink(t.andereTool.link);
  return content.tools.tools.some((x) => x.id === t.tool);
}

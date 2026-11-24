/**
 * Het adviesregister: berekent de uitkomst met de beslisregels en legt het advies vast.
 */
import type { Content } from "../content/laad-content";
import {
  haalConcept,
  haalEigenAdvies,
  koppelConceptAanAdvies,
  voegAdviesToe,
  volgendeReferentie,
  werkAdviesBij,
  type Aanvrager,
  type AdviesRij,
  type NieuwAdvies,
} from "../db/adviezen";
import { transactie } from "../db/pool";
import { ApiFout, nietGevonden } from "../lib/api";
import { evalueer, OngeldigeInvoerFout } from "../domain/beslisregels";
import { wizardDataSchema, type WizardData } from "../domain/wizard";
import { beslisInvoerUit, toolGekozen } from "../domain/invoer";

export { beslisInvoerUit, toolGekozen };

export function plusMaanden(datum: Date, maanden: number): Date {
  const d = new Date(datum);
  d.setMonth(d.getMonth() + maanden);
  return d;
}

/**
 * Berekent het advies voor een concept en legt het vast in het register.
 * - Nieuw concept → nieuw advies met nieuw referentienummer.
 * - Concept dat al een advies heeft zonder vervolgactie → dat advies wordt bijgewerkt
 *   (de medewerker ging terug en paste iets aan; het referentienummer blijft).
 * - Advies waarop al een vervolgactie is gedaan → nieuw advies, gekoppeld aan het vorige.
 */
export async function registreerAdvies(opties: {
  conceptId: string;
  pseudoniemId: string;
  content: Content;
  bewaartermijnMaanden: number;
  /** Naam en e-mail van de aanvrager (voor toetsers en beheerders), of null als die niet worden opgeslagen. */
  aanvrager?: Aanvrager | null;
  nu?: Date;
}): Promise<AdviesRij> {
  const { conceptId, pseudoniemId, content } = opties;
  const nu = opties.nu ?? new Date();

  return transactie(async (q) => {
    const concept = await haalConcept(conceptId, pseudoniemId, q);
    if (!concept) throw nietGevonden();
    const data = wizardDataSchema.parse(concept.data);

    if (!data.beschrijving.trim()) throw new ApiFout(400, "Beschrijf eerst wat je wilt bereiken (stap 1).");
    if (!toolGekozen(data, content)) throw new ApiFout(400, "Kies eerst een tool (stap 2).");

    const invoer = beslisInvoerUit(data, content);
    let uitkomst;
    try {
      uitkomst = evalueer(invoer, content.regelset);
    } catch (e) {
      if (e instanceof OngeldigeInvoerFout) throw new ApiFout(400, "Nog niet alle vragen zijn beantwoord.", e.fouten);
      throw e;
    }

    const nieuw: NieuwAdvies = {
      pseudoniemId,
      aanvrager: opties.aanvrager ?? null,
      beschrijving: data.beschrijving.trim(),
      verduidelijking: data.verduidelijking.filter((v) => v.antwoord.trim()),
      tooladvies: data.tooladvies!,
      antwoorden: { checks: invoer.checks, extraVragen: invoer.extraVragen ?? {}, verdieping: invoer.verdieping ?? {} },
      rodeVlaggen: invoer.rodeVlaggen,
      uitkomst: uitkomst.kleur,
      toetsers: uitkomst.toetsers,
      dpiaSignaal: uitkomst.dpiaSignaal,
      aiActSignaal: uitkomst.aiActSignaal,
      dpia: uitkomst.dpia,
      aiRisico: uitkomst.aiRisico,
      feiten: uitkomst.feiten,
      motivatie: uitkomst.motivatie,
      voorwaarden: uitkomst.voorwaarden,
      alternatieven: uitkomst.alternatieven,
      regelversie: uitkomst.regelversie,
      toolsversie: content.tools.versie,
      status: "advies_gegeven",
      vorigAdviesId: data.vorigAdviesId,
      verlooptOp: plusMaanden(nu, opties.bewaartermijnMaanden),
    };

    if (concept.adviesId) {
      const bestaand = await haalEigenAdvies(concept.adviesId, pseudoniemId, q);
      if (bestaand && bestaand.status === "advies_gegeven") {
        return werkAdviesBij(q, bestaand.id, { ...nieuw, vorigAdviesId: bestaand.vorigAdviesId });
      }
      if (bestaand) nieuw.vorigAdviesId = bestaand.id;
    }

    const referentie = await volgendeReferentie(q, nu.getFullYear());
    const advies = await voegAdviesToe(q, referentie, nieuw);
    await koppelConceptAanAdvies(q, conceptId, advies.id);
    return advies;
  });
}

/** Maakt de wizardgegevens voor "Er is iets veranderd" uit een eerder advies. */
export function wizardUitAdvies(advies: AdviesRij): WizardData {
  return wizardDataSchema.parse({
    stap: 1,
    beschrijving: advies.beschrijving,
    verduidelijking: advies.verduidelijking,
    verduidelijkingGevraagd: true,
    tooladvies: { ...advies.tooladvies, geaccepteerd: false },
    checks: advies.antwoorden.checks,
    checksVoorgesteld: true,
    fase2UitlegGezien: true,
    extraVragen: advies.antwoorden.extraVragen,
    verdieping: advies.antwoorden.verdieping ?? {},
    rodeVlaggen: advies.rodeVlaggen,
    vorigAdviesId: advies.id,
  });
}

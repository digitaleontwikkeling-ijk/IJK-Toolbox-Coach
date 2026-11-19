/**
 * Het adviesregister: berekent de uitkomst met de beslisregels en legt het advies vast.
 */
import type { Content } from "../content/laad-content";
import {
  haalConcept,
  haalEigenAdvies,
  koppelConceptAanAdvies,
  verwijderConceptenVanAdvies,
  voegAdviesToe,
  volgendeReferentie,
  werkAdviesBij,
  zetStatus,
  type AdviesRij,
  type NieuwAdvies,
} from "../db/adviezen";
import { transactie } from "../db/pool";
import { ApiFout, nietGevonden } from "../lib/api";
import { evalueer, extraVraagVanToepassing, OngeldigeInvoerFout, type BeslisInvoer } from "../domain/beslisregels";
import type { Status } from "../domain/content-schema";
import { wizardDataSchema, type WizardData } from "../domain/wizard";

export function beslisInvoerUit(data: WizardData, content: Content): BeslisInvoer {
  const invoer: BeslisInvoer = { checks: data.checks, rodeVlaggen: data.rodeVlaggen, extraVragen: {} };
  // Alleen extra vragen die bij de gekozen antwoorden horen tellen mee.
  for (const e of content.regelset.extra_vragen) {
    if (extraVraagVanToepassing(e.id, invoer, content.regelset) && e.id in data.extraVragen) {
      invoer.extraVragen![e.id] = data.extraVragen[e.id]!;
    }
  }
  return invoer;
}

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
  nu?: Date;
}): Promise<AdviesRij> {
  const { conceptId, pseudoniemId, content } = opties;
  const nu = opties.nu ?? new Date();

  return transactie(async (q) => {
    const concept = await haalConcept(conceptId, pseudoniemId, q);
    if (!concept) throw nietGevonden();
    const data = wizardDataSchema.parse(concept.data);

    if (!data.beschrijving.trim()) throw new ApiFout(400, "Beschrijf eerst wat je wilt bereiken (stap 1).");
    const tool = data.tooladvies?.tool;
    if (!tool || !content.tools.tools.some((t) => t.id === tool)) {
      throw new ApiFout(400, "Kies eerst een tool (stap 2).");
    }

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
      beschrijving: data.beschrijving.trim(),
      verduidelijking: data.verduidelijking.filter((v) => v.antwoord.trim()),
      tooladvies: data.tooladvies!,
      antwoorden: { checks: invoer.checks, extraVragen: invoer.extraVragen ?? {} },
      rodeVlaggen: invoer.rodeVlaggen,
      uitkomst: uitkomst.kleur,
      toetsers: uitkomst.toetsers,
      dpiaSignaal: uitkomst.dpiaSignaal,
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

/** De status na de vervolgactie, per type vervolgactie. */
const STATUS_NA_ACTIE: Record<string, Status | null> = {
  accountaanvraag: "account_aangevraagd",
  accountaanvraag_met_voorwaarden: "account_aangevraagd",
  toetsing: "in_toetsing",
  alleen_vastleggen: null,
};

/**
 * Voert de vervolgactie uit. In fase 3 wordt alleen de status gezet en gelogd;
 * in fase 5 komen hier de webhooks bij. Na de actie wordt het concept (met de
 * chat) verwijderd: in het register staat alleen wat nodig is.
 */
export async function voerVervolgactieUit(opties: { adviesId: string; pseudoniemId: string; content: Content }) {
  const advies = await haalEigenAdvies(opties.adviesId, opties.pseudoniemId);
  if (!advies) throw nietGevonden();
  if (advies.status !== "advies_gegeven") throw new ApiFout(409, "Voor dit advies is de vervolgactie al uitgevoerd.");
  const kleur = opties.content.regelset.kleuren.find((k) => k.id === advies.uitkomst);
  const nieuweStatus = kleur ? STATUS_NA_ACTIE[kleur.vervolgactie] : null;
  if (!nieuweStatus) throw new ApiFout(409, "Bij deze uitkomst hoort geen aanvraag.");
  await transactie((q) => zetStatus(q, advies.id, nieuweStatus));
  await verwijderConceptenVanAdvies(advies.id);
  console.info(`[actie] ${advies.referentie}: ${kleur!.vervolgactie} → ${nieuweStatus}`);
  return { status: nieuweStatus };
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
    extraVragen: advies.antwoorden.extraVragen,
    rodeVlaggen: advies.rodeVlaggen,
    vorigAdviesId: advies.id,
  });
}

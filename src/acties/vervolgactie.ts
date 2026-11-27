/**
 * Voert de vervolgactie bij een advies uit (zie opdracht §4.5):
 *   Direct aan de slag          → accountaanvraag
 *   Aan de slag met voorwaarden → accountaanvraag, inclusief voorwaarden
 *   Eerst toetsen               → aanvraag naar de toetser(s) + melding in Teams
 *   Niet op deze manier         → geen aanvraag (alleen vastgelegd); is er geen alternatief,
 *                                 dan een melding aan Team Digitale Ontwikkeling en status "contact volgt"
 *
 * Volgorde, zodat dubbel klikken of een mislukte webhook geen rommel geeft:
 * 1. de status wordt eerst "geclaimd" (alleen als die nog "advies gegeven" is);
 * 2. de hoofdactie wordt verstuurd; mislukt die, dan gaat de status terug en krijgt
 *    de medewerker een foutmelding;
 * 3. de Teams-melding mag mislukken zonder dat de aanvraag terugdraait (wel gelogd).
 */
import type { Content } from "../content/laad-content";
import { ANDERE_TOOL } from "../domain/content-schema";
import { geldigeLink } from "../domain/wizard";
import type { Gebruiker } from "../auth/sessie";
import { haalEigenAdvies, verwijderConceptenVanAdvies, type AdviesRij } from "../db/adviezen";
import { db } from "../db/pool";
import { ApiFout, nietGevonden } from "../lib/api";
import type { Status } from "../domain/content-schema";
import type { ActieClient, ActiePayload, ActieResultaat, ActieType } from "./ActieClient";

const STATUS_NA_ACTIE: Record<string, Status | null> = {
  accountaanvraag: "account_aangevraagd",
  accountaanvraag_met_voorwaarden: "account_aangevraagd",
  toetsing: "in_toetsing",
  alleen_vastleggen: null,
};

/** Is er bij dit advies contact met Team Digitale Ontwikkeling nodig (rood zonder alternatief)? */
export function contactNodig(advies: AdviesRij, content: Content): boolean {
  const kleur = content.regelset.kleuren.find((k) => k.id === advies.uitkomst);
  return !!kleur?.contact_als_geen_alternatief && kleur.vervolgactie === "alleen_vastleggen" && advies.alternatieven.length === 0;
}

async function logActie(adviesId: string, type: ActieType, r: ActieResultaat) {
  await db().query(
    "INSERT INTO actie_log (advies_id, type, resultaat, http_status, melding) VALUES ($1, $2, $3, $4, $5)",
    [adviesId, type, r.resultaat, r.httpStatus ?? null, r.melding ?? null],
  );
}

export interface VervolgactieOpties {
  adviesId: string;
  gebruiker: Gebruiker;
  content: Content;
  client: ActieClient;
  appUrl: string;
  stuurUpn: boolean;
}

export function maakPayloads(advies: AdviesRij, o: Omit<VervolgactieOpties, "adviesId" | "client">): ActiePayload[] {
  const { content, gebruiker, appUrl, stuurUpn } = o;
  const kleur = content.regelset.kleuren.find((k) => k.id === advies.uitkomst)!;
  const andere = advies.tooladvies.tool === ANDERE_TOOL ? advies.tooladvies.andereTool : undefined;
  const tool = andere
    ? {
        id: advies.tooladvies.tool,
        naam: andere.naam.trim(),
        buitenToolbox: true,
        ...(andere.link.trim() && geldigeLink(andere.link) ? { link: andere.link.trim() } : {}),
      }
    : (() => {
        const t = content.tools.tools.find((x) => x.id === advies.tooladvies.tool);
        // beheer: de flow stuurt de aanvraag per e-mail naar dit adres (zie docs/acties.md).
        return { id: advies.tooladvies.tool, naam: t?.naam, buitenToolbox: false, ...(t?.beheer ? { beheer: { naam: t.beheer.naam, email: t.beheer.email } } : {}) };
      })();
  const basis = {
    referentie: advies.referentie,
    adviesId: advies.id,
    aanvrager: { pseudoniemId: gebruiker.pseudoniemId, ...(stuurUpn && gebruiker.upn ? { upn: gebruiker.upn } : {}) },
    regelversie: advies.regelversie,
    tool,
    uitkomst: { kleur: kleur.id, naam: kleur.uitkomst },
  };

  if (contactNodig(advies, content)) {
    const toetsers = advies.toetsers.map((rol) => ({ rol, naam: content.regelset.toetsers.find((t) => t.id === rol)?.naam ?? rol }));
    return [
      {
        ...basis,
        type: "contact",
        link: `${appUrl}/beheer/advies/${advies.id}`,
        motivatie: advies.motivatie,
        toetsers,
        tekst: `Advies ${advies.referentie} is "${kleur.uitkomst}" zonder alternatief. Neem contact op met de medewerker.`,
      },
    ];
  }

  if (kleur.vervolgactie === "toetsing") {
    const toetsers = advies.toetsers.map((rol) => ({ rol, naam: content.regelset.toetsers.find((t) => t.id === rol)?.naam ?? rol }));
    const link = `${appUrl}/toetsing/${advies.id}`;
    return [
      {
        ...basis,
        type: "toetsing",
        link,
        toetsers,
        motivatie: advies.motivatie,
        dpiaSignaal: advies.dpiaSignaal,
        // Alleen de klassen; de onderbouwing (indicatoren, herkomst) leest de toetser in de app.
        privacy: advies.dpia?.actief ? { klasse: advies.dpia.klasse, score: advies.dpia.score } : null,
        ai: advies.aiRisico?.actief ? { klasse: advies.aiRisico.klasse } : null,
      },
      {
        ...basis,
        type: "teams_melding",
        link,
        ontvangers: toetsers,
        tekst: `Nieuwe aanvraag ${advies.referentie} (${tool.naam}) wacht op je toetsing.`,
      },
    ];
  }
  return [{ ...basis, type: "accountaanvraag", link: `${appUrl}/advies/${advies.id}`, voorwaarden: advies.voorwaarden }];
}

export async function voerVervolgactieUit(o: VervolgactieOpties): Promise<{ status: Status; meldingVerstuurd?: boolean }> {
  const advies = await haalEigenAdvies(o.adviesId, o.gebruiker.pseudoniemId);
  if (!advies) throw nietGevonden();
  const kleur = o.content.regelset.kleuren.find((k) => k.id === advies.uitkomst);
  const nieuweStatus: Status | null = contactNodig(advies, o.content)
    ? "contact_volgt"
    : kleur
      ? (STATUS_NA_ACTIE[kleur.vervolgactie] ?? null)
      : null;
  if (!nieuweStatus) throw new ApiFout(409, "Bij deze uitkomst hoort geen aanvraag.");

  // 1. Claimen: lukt maar één keer, ook bij dubbel klikken.
  const claim = await db().query(
    "UPDATE advies SET status = $2, bijgewerkt_op = now() WHERE id = $1 AND status = 'advies_gegeven' RETURNING id",
    [advies.id, nieuweStatus],
  );
  if (claim.rowCount === 0) throw new ApiFout(409, "Voor dit advies is de vervolgactie al uitgevoerd.");

  const [hoofd, melding] = maakPayloads(advies, o);

  // 2. Hoofdactie.
  const r = await o.client.verstuur(hoofd!);
  await logActie(advies.id, hoofd!.type, r);
  if (!r.ok) {
    await db().query("UPDATE advies SET status = 'advies_gegeven', bijgewerkt_op = now() WHERE id = $1", [advies.id]);
    throw new ApiFout(502, "Je aanvraag kon niet worden verstuurd. Probeer het later opnieuw.");
  }

  // 3. Teams-melding (alleen bij toetsing); een mislukte melding blokkeert de aanvraag niet.
  let meldingVerstuurd: boolean | undefined;
  if (melding) {
    const m = await o.client.verstuur(melding);
    await logActie(advies.id, melding.type, m);
    meldingVerstuurd = m.ok;
    if (!m.ok) console.warn(`[actie] Teams-melding voor ${advies.referentie} mislukt: ${m.melding}`);
  }

  // Het concept (met de chat) is niet meer nodig: in het register staat alleen wat nodig is.
  await verwijderConceptenVanAdvies(advies.id);
  return { status: nieuweStatus, meldingVerstuurd };
}

/**
 * Rood zonder alternatief: direct een melding aan Team Digitale Ontwikkeling, maximaal één keer
 * per advies (keuze IJK). Mislukt de melding, dan blijft de status "advies gegeven" en kan de
 * medewerker het opnieuw proberen via de vervolgactie. Geeft de (eventueel nieuwe) status terug.
 */
export async function meldContactIndienNodig(
  advies: AdviesRij,
  o: Omit<VervolgactieOpties, "adviesId">,
): Promise<Status> {
  if (advies.status !== "advies_gegeven" || !contactNodig(advies, o.content)) return advies.status;
  try {
    return (await voerVervolgactieUit({ ...o, adviesId: advies.id })).status;
  } catch (e) {
    console.warn(`[actie] Contactmelding voor ${advies.referentie} mislukt: ${(e as Error).message}`);
    return "advies_gegeven";
  }
}

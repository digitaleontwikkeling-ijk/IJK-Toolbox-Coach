/**
 * Database-toegang voor concepten en het adviesregister. Alleen SQL, geen logica.
 * Elke query op persoonlijke gegevens filtert op pseudoniem_id, tenzij de functie
 * expliciet voor toetsers of beheerders is (fase 5).
 */
import type { PoolClient } from "pg";
import type { Status } from "../domain/content-schema";
import type { Tooladvies, WizardData } from "../domain/wizard";
import { db } from "./pool";

type Querier = Pick<PoolClient, "query">;

// ---------- Concepten ----------

export interface ConceptRij {
  id: string;
  data: unknown;
  adviesId: string | null;
  bijgewerktOp: Date;
}

const conceptVelden = "id, data, advies_id AS \"adviesId\", bijgewerkt_op AS \"bijgewerktOp\"";

export async function maakConcept(pseudoniemId: string, data: WizardData): Promise<ConceptRij> {
  const r = await db().query(
    `INSERT INTO concept (pseudoniem_id, data) VALUES ($1, $2) RETURNING ${conceptVelden}`,
    [pseudoniemId, data],
  );
  return r.rows[0];
}

export async function haalConcept(id: string, pseudoniemId: string, q: Querier = db()): Promise<ConceptRij | null> {
  const r = await q.query(`SELECT ${conceptVelden} FROM concept WHERE id = $1 AND pseudoniem_id = $2`, [id, pseudoniemId]);
  return r.rows[0] ?? null;
}

/** Het meest recente concept van deze medewerker (om verder te gaan waar je was). */
export async function laatsteConcept(pseudoniemId: string): Promise<ConceptRij | null> {
  const r = await db().query(
    `SELECT ${conceptVelden} FROM concept WHERE pseudoniem_id = $1 ORDER BY bijgewerkt_op DESC LIMIT 1`,
    [pseudoniemId],
  );
  return r.rows[0] ?? null;
}

export async function bewaarConcept(id: string, pseudoniemId: string, data: WizardData): Promise<boolean> {
  const r = await db().query(
    "UPDATE concept SET data = $3, bijgewerkt_op = now() WHERE id = $1 AND pseudoniem_id = $2",
    [id, pseudoniemId, data],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function koppelConceptAanAdvies(q: Querier, conceptId: string, adviesId: string) {
  await q.query("UPDATE concept SET advies_id = $2, bijgewerkt_op = now() WHERE id = $1", [conceptId, adviesId]);
}

export async function verwijderConcept(id: string, pseudoniemId: string): Promise<void> {
  await db().query("DELETE FROM concept WHERE id = $1 AND pseudoniem_id = $2", [id, pseudoniemId]);
}

export async function verwijderConceptenVanAdvies(adviesId: string): Promise<void> {
  await db().query("DELETE FROM concept WHERE advies_id = $1", [adviesId]);
}

// ---------- Adviesregister ----------

export interface AdviesRij {
  id: string;
  referentie: string;
  pseudoniemId: string;
  aangemaaktOp: Date;
  bijgewerktOp: Date;
  beschrijving: string;
  verduidelijking: { vraag: string; antwoord: string }[];
  tooladvies: Tooladvies;
  antwoorden: { checks: Record<string, string>; extraVragen: Record<string, boolean> };
  rodeVlaggen: Record<string, boolean>;
  uitkomst: string;
  toetsers: string[];
  dpiaSignaal: boolean;
  motivatie: string;
  voorwaarden: string[];
  alternatieven: string[];
  regelversie: string;
  toolsversie: string;
  status: Status;
  vorigAdviesId: string | null;
  verlooptOp: Date;
}

const adviesVelden = `id, referentie, pseudoniem_id AS "pseudoniemId", aangemaakt_op AS "aangemaaktOp",
  bijgewerkt_op AS "bijgewerktOp", beschrijving, verduidelijking, tooladvies, antwoorden,
  rode_vlaggen AS "rodeVlaggen", uitkomst, toetsers, dpia_signaal AS "dpiaSignaal", motivatie,
  voorwaarden, alternatieven, regelversie, toolsversie, status, vorig_advies_id AS "vorigAdviesId",
  verloopt_op AS "verlooptOp"`;

export type NieuwAdvies = Omit<AdviesRij, "id" | "referentie" | "aangemaaktOp" | "bijgewerktOp">;

/** Geeft het volgende referentienummer: TC-JJJJ-NNNN, per jaar opnieuw vanaf 0001. */
export async function volgendeReferentie(q: Querier, jaar: number): Promise<string> {
  const r = await q.query(
    `INSERT INTO referentie_teller (jaar, laatste) VALUES ($1, 1)
     ON CONFLICT (jaar) DO UPDATE SET laatste = referentie_teller.laatste + 1
     RETURNING laatste`,
    [jaar],
  );
  return `TC-${jaar}-${String(r.rows[0].laatste).padStart(4, "0")}`;
}

function adviesParameters(a: NieuwAdvies) {
  return [
    a.pseudoniemId, a.beschrijving, JSON.stringify(a.verduidelijking), a.tooladvies, a.antwoorden,
    a.rodeVlaggen, a.uitkomst, a.toetsers, a.dpiaSignaal, a.motivatie, JSON.stringify(a.voorwaarden),
    JSON.stringify(a.alternatieven), a.regelversie, a.toolsversie, a.status, a.vorigAdviesId, a.verlooptOp,
  ];
}

export async function voegAdviesToe(q: Querier, referentie: string, a: NieuwAdvies): Promise<AdviesRij> {
  const r = await q.query(
    `INSERT INTO advies (pseudoniem_id, beschrijving, verduidelijking, tooladvies, antwoorden, rode_vlaggen,
       uitkomst, toetsers, dpia_signaal, motivatie, voorwaarden, alternatieven, regelversie, toolsversie,
       status, vorig_advies_id, verloopt_op, referentie)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING ${adviesVelden}`,
    [...adviesParameters(a), referentie],
  );
  return r.rows[0];
}

/** Werkt een advies bij dat nog geen vervolgactie heeft gehad (medewerker ging terug en paste aan). */
export async function werkAdviesBij(q: Querier, id: string, a: NieuwAdvies): Promise<AdviesRij> {
  const r = await q.query(
    `UPDATE advies SET pseudoniem_id=$1, beschrijving=$2, verduidelijking=$3, tooladvies=$4, antwoorden=$5,
       rode_vlaggen=$6, uitkomst=$7, toetsers=$8, dpia_signaal=$9, motivatie=$10, voorwaarden=$11,
       alternatieven=$12, regelversie=$13, toolsversie=$14, status=$15, vorig_advies_id=$16, verloopt_op=$17,
       bijgewerkt_op=now()
     WHERE id=$18 RETURNING ${adviesVelden}`,
    [...adviesParameters(a), id],
  );
  return r.rows[0];
}

export async function haalEigenAdvies(id: string, pseudoniemId: string, q: Querier = db()): Promise<AdviesRij | null> {
  const r = await q.query(`SELECT ${adviesVelden} FROM advies WHERE id = $1 AND pseudoniem_id = $2`, [id, pseudoniemId]);
  return r.rows[0] ?? null;
}

export async function eigenAdviezen(pseudoniemId: string): Promise<AdviesRij[]> {
  const r = await db().query(
    `SELECT ${adviesVelden} FROM advies WHERE pseudoniem_id = $1 ORDER BY aangemaakt_op DESC`,
    [pseudoniemId],
  );
  return r.rows;
}

export async function zetStatus(q: Querier, id: string, status: Status): Promise<void> {
  await q.query("UPDATE advies SET status = $2, bijgewerkt_op = now() WHERE id = $1", [id, status]);
}

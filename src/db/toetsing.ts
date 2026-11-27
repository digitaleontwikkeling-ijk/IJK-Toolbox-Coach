/** Database-toegang voor toetsers, beheerders en de audit-log. Alleen SQL. */
import type { PoolClient } from "pg";
import type { Besluit } from "../domain/besluiten";
import { adviesVelden, type AdviesRij } from "./adviezen";
import { db } from "./pool";

type Querier = Pick<PoolClient, "query">;

export interface BesluitRij {
  id: string;
  adviesId: string;
  toetserRol: string;
  toetserPseudoniemId: string;
  besluit: Besluit;
  toelichting: string | null;
  datum: Date;
}

const besluitVelden = `id, advies_id AS "adviesId", toetser_rol AS "toetserRol",
  toetser_pseudoniem_id AS "toetserPseudoniemId", besluit, toelichting, datum`;

/**
 * Adviezen voor (één van) deze toetserrollen: ingediende aanvragen, plus adviezen met een
 * uitkomst "ter informatie" (Niet op deze manier), ook als er geen aanvraag is.
 */
export async function adviezenVoorToetsers(rollen: string[], terInformatie: string[]): Promise<AdviesRij[]> {
  const r = await db().query(
    `SELECT ${adviesVelden} FROM advies
     WHERE toetsers && $1::text[] AND (status <> 'advies_gegeven' OR uitkomst = ANY($2::text[]))
     ORDER BY aangemaakt_op DESC`,
    [rollen, terInformatie],
  );
  return r.rows;
}

export async function alleAdviezen(): Promise<AdviesRij[]> {
  const r = await db().query(`SELECT ${adviesVelden} FROM advies ORDER BY aangemaakt_op DESC`);
  return r.rows;
}

export async function haalAdvies(id: string, q: Querier = db(), opties: { voorUpdate?: boolean } = {}): Promise<AdviesRij | null> {
  const r = await q.query(`SELECT ${adviesVelden} FROM advies WHERE id = $1${opties.voorUpdate ? " FOR UPDATE" : ""}`, [id]);
  return r.rows[0] ?? null;
}

export async function besluitenVan(adviesIds: string[], q: Querier = db()): Promise<BesluitRij[]> {
  if (adviesIds.length === 0) return [];
  const r = await q.query(`SELECT ${besluitVelden} FROM besluit WHERE advies_id = ANY($1::uuid[]) ORDER BY datum`, [adviesIds]);
  return r.rows;
}

export async function voegBesluitToe(
  q: Querier,
  b: { adviesId: string; toetserRol: string; toetserPseudoniemId: string; besluit: Besluit; toelichting: string | null },
): Promise<void> {
  await q.query(
    `INSERT INTO besluit (advies_id, toetser_rol, toetser_pseudoniem_id, besluit, toelichting) VALUES ($1, $2, $3, $4, $5)`,
    [b.adviesId, b.toetserRol, b.toetserPseudoniemId, b.besluit, b.toelichting],
  );
}

export async function zetStatusNaBesluit(q: Querier, id: string, status: string): Promise<void> {
  await q.query("UPDATE advies SET status = $2, bijgewerkt_op = now() WHERE id = $1", [id, status]);
}

export type AuditActie = "inzage_lijst" | "inzage_advies" | "besluit" | "inzage_content" | "mailsjabloon_gewijzigd";

/** Audit-log van inzage en besluiten door toetsers en beheerders. */
export async function audit(
  q: Querier,
  e: { pseudoniemId: string; rol: string; actie: AuditActie; adviesId?: string | null },
): Promise<void> {
  await q.query("INSERT INTO audit_log (pseudoniem_id, rol, actie, advies_id) VALUES ($1, $2, $3, $4)", [
    e.pseudoniemId,
    e.rol,
    e.actie,
    e.adviesId ?? null,
  ]);
}

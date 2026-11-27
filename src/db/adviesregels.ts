/** Adviesregels die een beheerder heeft gewijzigd, toegevoegd of verwijderd, met de wijzigingshistorie. */
import type { PoolClient } from "pg";
import type { Adviesregel, Historie, Opgeslagen } from "@/domain/adviesregels";
import { db } from "./pool";

type Querier = Pick<PoolClient, "query">;

export async function haalAdviesregels(q: Querier = db()): Promise<{ opgeslagen: Record<string, Opgeslagen>; laatsteWijziging: number }> {
  const r = await q.query(
    `SELECT id, regel, verwijderd, bijgewerkt_op AS "bijgewerktOp", bijgewerkt_door AS "bijgewerktDoor" FROM adviesregel`,
  );
  const n = await q.query("SELECT coalesce(max(nr), 0)::int AS nr FROM adviesregel_historie");
  const opgeslagen: Record<string, Opgeslagen> = {};
  for (const x of r.rows as { id: string; regel: Adviesregel | null; verwijderd: boolean; bijgewerktOp: Date; bijgewerktDoor: string }[]) {
    opgeslagen[x.id] = { regel: x.regel, verwijderd: x.verwijderd, bijgewerktOp: x.bijgewerktOp.toISOString(), bijgewerktDoor: x.bijgewerktDoor };
  }
  return { opgeslagen, laatsteWijziging: n.rows[0].nr as number };
}

/** Slaat één wijziging op (null = rij weg: dan geldt de standaard) en legt de vorige en nieuwe regel vast. */
export async function zetAdviesregel(
  q: Querier,
  w: { id: string; opslaan: Opgeslagen | null; vorige: Adviesregel | null; nieuwe: Adviesregel | null },
  door: string,
): Promise<void> {
  if (w.opslaan) {
    await q.query(
      `INSERT INTO adviesregel (id, regel, verwijderd, bijgewerkt_door) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET regel = $2, verwijderd = $3, bijgewerkt_door = $4, bijgewerkt_op = now()`,
      [w.id, w.opslaan.regel ? JSON.stringify(w.opslaan.regel) : null, w.opslaan.verwijderd, door],
    );
  } else {
    await q.query("DELETE FROM adviesregel WHERE id = $1", [w.id]);
  }
  await q.query("INSERT INTO adviesregel_historie (regel_id, vorige, nieuwe, gewijzigd_door) VALUES ($1, $2, $3, $4)", [
    w.id,
    w.vorige ? JSON.stringify(w.vorige) : null,
    w.nieuwe ? JSON.stringify(w.nieuwe) : null,
    door,
  ]);
}

export async function haalHistorie(q: Querier = db(), limiet = 30): Promise<Historie[]> {
  const r = await q.query(
    `SELECT nr::int AS nr, regel_id AS "regelId", vorige, nieuwe, gewijzigd_op AS "gewijzigdOp"
     FROM adviesregel_historie ORDER BY nr DESC LIMIT $1`,
    [limiet],
  );
  return r.rows.map((x: Historie & { gewijzigdOp: Date }) => ({ ...x, gewijzigdOp: new Date(x.gewijzigdOp).toISOString() }));
}

export async function haalHistorieRegel(q: Querier, nr: number): Promise<Historie | null> {
  const r = await q.query(
    `SELECT nr::int AS nr, regel_id AS "regelId", vorige, nieuwe, gewijzigd_op AS "gewijzigdOp" FROM adviesregel_historie WHERE nr = $1`,
    [nr],
  );
  const x = r.rows[0];
  return x ? { ...x, gewijzigdOp: new Date(x.gewijzigdOp).toISOString() } : null;
}

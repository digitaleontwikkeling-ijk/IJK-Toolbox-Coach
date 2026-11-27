/** Eigen mailsjablonen voor de licentieaanvraag (per tool, ingesteld door een beheerder). */
import type { Mailsjabloon } from "@/domain/mailsjablonen";
import type { PoolClient } from "pg";
import { db } from "./pool";

type Querier = Pick<PoolClient, "query">;

export async function haalMailsjablonen(q: Querier = db()): Promise<Record<string, Mailsjabloon>> {
  const r = await q.query("SELECT tool, onderwerp, tekst FROM mailsjabloon");
  return Object.fromEntries(r.rows.map((x: { tool: string; onderwerp: string; tekst: string }) => [x.tool, { onderwerp: x.onderwerp, tekst: x.tekst }]));
}

export async function zetMailsjabloon(q: Querier, tool: string, s: Mailsjabloon, door: string): Promise<void> {
  await q.query(
    `INSERT INTO mailsjabloon (tool, onderwerp, tekst, bijgewerkt_door) VALUES ($1, $2, $3, $4)
     ON CONFLICT (tool) DO UPDATE SET onderwerp = $2, tekst = $3, bijgewerkt_door = $4, bijgewerkt_op = now()`,
    [tool, s.onderwerp, s.tekst, door],
  );
}

export async function verwijderMailsjabloon(q: Querier, tool: string): Promise<void> {
  await q.query("DELETE FROM mailsjabloon WHERE tool = $1", [tool]);
}

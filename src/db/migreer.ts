/**
 * Voert nog niet uitgevoerde SQL-migraties uit (src/db/migraties/*.sql, op naam gesorteerd).
 * Gebruik: npm run db:migreer
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { db, sluitDb, transactie } from "./pool";

const MAP = path.resolve(process.cwd(), "src/db/migraties");

export async function migreer(): Promise<string[]> {
  await db().query(
    "CREATE TABLE IF NOT EXISTS schema_migraties (naam text PRIMARY KEY, uitgevoerd_op timestamptz NOT NULL DEFAULT now())",
  );
  const gedaan = new Set((await db().query("SELECT naam FROM schema_migraties")).rows.map((r) => r.naam as string));
  const nieuw: string[] = [];
  for (const bestand of readdirSync(MAP).filter((f) => f.endsWith(".sql")).sort()) {
    if (gedaan.has(bestand)) continue;
    const sql = readFileSync(path.join(MAP, bestand), "utf8");
    await transactie(async (c) => {
      await c.query(sql);
      await c.query("INSERT INTO schema_migraties (naam) VALUES ($1)", [bestand]);
    });
    nieuw.push(bestand);
  }
  return nieuw;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  migreer()
    .then((n) => console.log(n.length ? `Uitgevoerd: ${n.join(", ")}` : "Database is up-to-date."))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(sluitDb);
}

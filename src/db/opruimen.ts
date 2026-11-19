/**
 * Verwijdert gegevens na de bewaartermijn:
 * - adviezen waarvan `verloopt_op` voorbij is (BEWAARTERMIJN_MAANDEN, standaard 12);
 * - onafgemaakte wizards (inclusief chat) ouder dan CONCEPT_BEWAARDAGEN (standaard 30).
 * Draai dagelijks, bijvoorbeeld via een geplande taak: npm run opruimen
 */
import path from "node:path";
import { config } from "../lib/config";
import { db, sluitDb } from "./pool";

export async function ruimOp(nu = new Date()) {
  const adviezen = await db().query("DELETE FROM advies WHERE verloopt_op < $1", [nu]);
  const concepten = await db().query(
    "DELETE FROM concept WHERE bijgewerkt_op < $1::timestamptz - make_interval(days => $2)",
    [nu, config.conceptBewaardagen],
  );
  const audit = await db().query(
    "DELETE FROM audit_log WHERE tijd < $1::timestamptz - make_interval(months => $2)",
    [nu, config.bewaartermijnMaanden],
  );
  return { adviezen: adviezen.rowCount ?? 0, concepten: concepten.rowCount ?? 0, audit: audit.rowCount ?? 0 };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  ruimOp()
    .then((r) => console.log(`Opgeruimd: ${r.adviezen} adviezen, ${r.concepten} concepten, ${r.audit} auditregels.`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(sluitDb);
}

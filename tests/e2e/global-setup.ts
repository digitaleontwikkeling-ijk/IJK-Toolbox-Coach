/** Zet de testdatabase klaar: migraties uitvoeren en alle gegevens wissen. */
import { Client } from "pg";
import { execSync } from "node:child_process";

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://coach:coach_dev@localhost:5432/toolbox_coach_test";
  execSync("npx tsx src/db/migreer.ts", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("TRUNCATE concept, besluit, audit_log, advies, referentie_teller RESTART IDENTITY CASCADE");
  await c.end();
}

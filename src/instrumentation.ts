/** Wordt één keer uitgevoerd bij het starten van de server: databasemigraties bijwerken. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { migreer } = await import("./db/migreer");
  const nieuw = await migreer();
  if (nieuw.length) console.info(`Databasemigraties uitgevoerd: ${nieuw.join(", ")}`);
}

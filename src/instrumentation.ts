/** Wordt één keer uitgevoerd bij het starten van de server: databasemigraties bijwerken. */
export async function register() {
  // Deze vorm laat Next.js de database-code buiten de edge-bundel houden.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}

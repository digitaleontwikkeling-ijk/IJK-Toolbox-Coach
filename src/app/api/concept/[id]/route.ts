import { bewaarConcept, verwijderConcept } from "@/db/adviezen";
import { wizardDataSchema } from "@/domain/wizard";
import { body, nietGevonden, route, vereisUuid } from "@/lib/api";

/** Wizardgegevens opslaan (bij elke stap). */
export const PUT = route<{ id: string }>(["medewerker"], async ({ req, gebruiker, params }) => {
  const data = await body(req, wizardDataSchema);
  if (!(await bewaarConcept(vereisUuid(params.id), gebruiker.pseudoniemId, data))) throw nietGevonden();
  return { ok: true };
});

/** "Opnieuw beginnen": het concept (inclusief chat) wordt verwijderd. */
export const DELETE = route<{ id: string }>(["medewerker"], async ({ gebruiker, params }) => {
  await verwijderConcept(vereisUuid(params.id), gebruiker.pseudoniemId);
  return { ok: true };
});

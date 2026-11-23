import { bewaarConcept, haalConcept, verwijderConcept } from "@/db/adviezen";
import { legeWizard, wizardDataSchema } from "@/domain/wizard";
import { body, nietGevonden, route, vereisUuid } from "@/lib/api";

/** Eén eigen concept (de wizard onthoudt via ?concept= aan welk idee je werkt). */
export const GET = route<{ id: string }>(["medewerker"], async ({ gebruiker, params }) => {
  const c = await haalConcept(vereisUuid(params.id), gebruiker.pseudoniemId);
  if (!c) throw nietGevonden();
  const data = wizardDataSchema.safeParse(c.data);
  return { concept: { id: c.id, adviesId: c.adviesId, data: data.success ? data.data : legeWizard() } };
});

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

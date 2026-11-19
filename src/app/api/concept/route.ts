/** Het concept (de onafgemaakte wizard) van de ingelogde medewerker. */
import { laatsteConcept, maakConcept } from "@/db/adviezen";
import { legeWizard, wizardDataSchema } from "@/domain/wizard";
import { route } from "@/lib/api";

/** Laatste concept, om verder te gaan waar je was. */
export const GET = route(["medewerker"], async ({ gebruiker }) => {
  const c = await laatsteConcept(gebruiker.pseudoniemId);
  if (!c) return { concept: null };
  const data = wizardDataSchema.safeParse(c.data);
  return { concept: { id: c.id, adviesId: c.adviesId, data: data.success ? data.data : legeWizard() } };
});

/** Nieuw, leeg concept. */
export const POST = route(["medewerker"], async ({ gebruiker }) => {
  const c = await maakConcept(gebruiker.pseudoniemId, legeWizard());
  return { concept: { id: c.id, adviesId: null, data: c.data } };
});

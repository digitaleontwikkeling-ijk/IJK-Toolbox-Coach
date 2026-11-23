/** Concepten (onafgemaakte wizards) van de ingelogde medewerker. */
import { laatsteOnafgemaaktConcept, maakConcept, ruimConceptenOp } from "@/db/adviezen";
import { legeWizard, wizardDataSchema } from "@/domain/wizard";
import { route } from "@/lib/api";

/** Het laatste onafgemaakte idee (beschrijving, nog geen advies), om eventueel mee verder te gaan. */
export const GET = route(["medewerker"], async ({ gebruiker }) => {
  const c = await laatsteOnafgemaaktConcept(gebruiker.pseudoniemId);
  if (!c) return { concept: null };
  const data = wizardDataSchema.safeParse(c.data);
  return { concept: { id: c.id, adviesId: c.adviesId, data: data.success ? data.data : legeWizard() } };
});

/** Nieuw idee: ruimt lege en afgeronde concepten op en maakt een leeg concept. */
export const POST = route(["medewerker"], async ({ gebruiker }) => {
  await ruimConceptenOp(gebruiker.pseudoniemId);
  const c = await maakConcept(gebruiker.pseudoniemId, legeWizard());
  return { concept: { id: c.id, adviesId: null, data: c.data } };
});

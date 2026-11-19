import { body, route, vereisUuid } from "@/lib/api";
import { besluitInvoerSchema, legBesluitVast } from "@/register/toetsing";

export const POST = route<{ id: string }>(["toetser_compliance", "toetser_architect"], async ({ req, gebruiker, params }) =>
  legBesluitVast(gebruiker, vereisUuid(params.id), await body(req, besluitInvoerSchema)),
);

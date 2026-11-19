/**
 * Coach-taken. Elk antwoord is gevalideerd; `resultaat: null` betekent:
 * de coach is niet beschikbaar of gaf een ongeldig antwoord → handmatig invullen.
 */
import { z } from "zod";
import { haalEigenAdvies } from "@/db/adviezen";
import { body, nietGevonden, route, vereisUuid } from "@/lib/api";
import { coachService, content } from "@/lib/app";

const beschrijving = z.string().trim().min(1).max(4000);
const verduidelijking = z.array(z.object({ vraag: z.string().max(500), antwoord: z.string().max(1000) })).max(2).default([]);
const toolId = z.string().regex(/^[a-z0-9_]+$/).max(64);

export const POST = route<{ taak: string }>(["medewerker"], async ({ req, gebruiker, params }) => {
  const coach = coachService();
  const ctx = { pseudoniemId: gebruiker.pseudoniemId };

  switch (params.taak) {
    case "verduidelijk": {
      const b = await body(req, z.object({ beschrijving }));
      return { resultaat: await coach.verduidelijk(b, ctx) };
    }
    case "tooladvies": {
      const b = await body(req, z.object({ beschrijving, verduidelijking, uitsluiten: z.array(toolId).max(10).default([]) }));
      return { resultaat: await coach.tooladvies(b, ctx) };
    }
    case "checks": {
      const b = await body(req, z.object({ beschrijving, verduidelijking, tool: toolId }));
      return { resultaat: await coach.checksVoorinvullen(b, ctx) };
    }
    case "uitleg": {
      const b = await body(req, z.object({ adviesId: z.string() }));
      const advies = await haalEigenAdvies(vereisUuid(b.adviesId), gebruiker.pseudoniemId);
      if (!advies) throw nietGevonden();
      const r = content().regelset;
      const antwoorden: Record<string, string> = {};
      for (const c of r.checks) {
        antwoorden[c.naam] = c.antwoorden.find((a) => a.id === advies.antwoorden.checks[c.id])?.label ?? "";
      }
      const kleur = r.kleuren.find((k) => k.id === advies.uitkomst)!;
      const uitleg = await coach.uitleg(
        {
          beschrijving: advies.beschrijving,
          tool: advies.tooladvies.tool,
          antwoorden,
          uitkomst: {
            regelversie: advies.regelversie,
            kleur: kleur.id,
            uitkomst: kleur.uitkomst,
            vervolgactie: kleur.vervolgactie,
            redenen: [],
            motivatie: advies.motivatie,
            toetsers: advies.toetsers,
            dpiaSignaal: advies.dpiaSignaal,
            voorwaarden: advies.voorwaarden,
            alternatieven: advies.alternatieven,
          },
        },
        ctx,
      );
      return { resultaat: uitleg };
    }
    case "chat": {
      const b = await body(
        req,
        z.object({
          vraag: z.string().trim().min(1).max(2000),
          stap: z.number().int().min(1).max(4),
          beschrijving: z.string().max(4000).default(""),
          tool: toolId.optional(),
          geschiedenis: z.array(z.object({ rol: z.enum(["coach", "medewerker"]), tekst: z.string().max(2000) })).max(20).default([]),
        }),
      );
      return { resultaat: await coach.chat(b, ctx) };
    }
    default:
      throw nietGevonden();
  }
});

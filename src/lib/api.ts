/**
 * Hulpfuncties voor API-routes: autorisatie, invoervalidatie en foutafhandeling.
 * Elke route gebruikt `route(...)`, zodat autorisatie nooit vergeten kan worden.
 */
import { ZodError, type ZodTypeAny, type z } from "zod";
import { gebruikerUitRequest, heeftRol, type Gebruiker } from "../auth/sessie";
import type { Rol } from "../auth/rollen";

export class ApiFout extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) {
    super(message);
  }
}

export const nietGevonden = () => new ApiFout(404, "Niet gevonden.");

type Context<P> = { params: Promise<P> };
type Handler<P> = (args: { req: Request; gebruiker: Gebruiker; params: P }) => Promise<unknown>;

/** Maakt een route handler die alleen toegankelijk is voor gebruikers met één van de `rollen`. */
export function route<P = Record<string, string>>(rollen: Rol[], handler: Handler<P>) {
  return async (req: Request, ctx: Context<P>): Promise<Response> => {
    try {
      const gebruiker = gebruikerUitRequest(req);
      if (!gebruiker) throw new ApiFout(401, "Je bent niet ingelogd.");
      if (!heeftRol(gebruiker, ...rollen)) throw new ApiFout(403, "Je hebt geen toegang tot deze gegevens.");
      const params = ((await ctx?.params) ?? {}) as P;
      const resultaat = await handler({ req, gebruiker, params });
      if (resultaat instanceof Response) return resultaat;
      return Response.json(resultaat ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiFout) {
        return Response.json({ fout: e.message, details: e.details }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return Response.json(
          { fout: "Ongeldige invoer.", details: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
          { status: 400 },
        );
      }
      console.error(e);
      return Response.json({ fout: "Er ging iets mis. Probeer het later opnieuw." }, { status: 500 });
    }
  };
}

/** Leest en valideert de JSON-body. */
export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let ruw: unknown;
  try {
    ruw = await req.json();
  } catch {
    throw new ApiFout(400, "De invoer is geen geldige JSON.");
  }
  return schema.parse(ruw);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function vereisUuid(id: string): string {
  if (!UUID.test(id)) throw nietGevonden();
  return id;
}

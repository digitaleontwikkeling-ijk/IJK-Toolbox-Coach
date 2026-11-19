/** Nep-login voor de proof of concept: kies een testgebruiker. */
import { z } from "zod";
import { TESTGEBRUIKERS } from "@/auth/testgebruikers";
import { cookieOpties, maakSessieCookie, SESSIE_COOKIE } from "@/auth/sessie";
import { config } from "@/lib/config";

export async function GET() {
  if (config.authModus !== "nep") return new Response(null, { status: 404 });
  // Alleen wat nodig is om te kiezen; geen rollen-escalatie mogelijk via de client.
  return Response.json(TESTGEBRUIKERS.map((g) => ({ oid: g.oid, naam: g.naam, rollen: g.rollen })));
}

export async function POST(req: Request) {
  if (config.authModus !== "nep") return new Response(null, { status: 404 });
  const parsed = z.object({ oid: z.string().max(64) }).safeParse(await req.json().catch(() => null));
  const gebruiker = parsed.success ? TESTGEBRUIKERS.find((g) => g.oid === parsed.data.oid) : undefined;
  if (!gebruiker) return Response.json({ fout: "Onbekende testgebruiker." }, { status: 400 });
  const res = Response.json({ ok: true });
  const o = cookieOpties();
  res.headers.append(
    "Set-Cookie",
    `${SESSIE_COOKIE}=${encodeURIComponent(maakSessieCookie({ oid: gebruiker.oid, naam: gebruiker.naam, upn: gebruiker.upn, rollen: gebruiker.rollen }))}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`,
  );
  return res;
}

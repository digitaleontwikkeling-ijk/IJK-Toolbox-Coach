/**
 * Inloggen met Microsoft Entra ID. De browser haalt een token op (in Teams via
 * Teams-SSO, los via MSAL) en stuurt het hierheen. De server controleert het en
 * maakt een sessie. De rest van de app werkt alleen met die sessie.
 */
import { z } from "zod";
import { controleerEntraToken, OngeldigTokenFout } from "@/auth/entra";
import { maakSessieCookie, sessieCookieHeader } from "@/auth/sessie";
import { config } from "@/lib/config";

export async function POST(req: Request) {
  if (config.authModus !== "entra") return new Response(null, { status: 404 });
  const parsed = z.object({ token: z.string().min(20).max(10_000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ fout: "Geen geldig token ontvangen." }, { status: 400 });
  try {
    const id = await controleerEntraToken(parsed.data.token, config.entra);
    const res = Response.json({ ok: true, naam: id.naam, rollen: id.rollen });
    res.headers.append("Set-Cookie", sessieCookieHeader(maakSessieCookie(id), { inIframe: config.cookieInIframe }));
    return res;
  } catch (e) {
    if (e instanceof OngeldigTokenFout) {
      console.warn(e.message);
      return Response.json({ fout: "Inloggen is niet gelukt." }, { status: 401 });
    }
    throw e;
  }
}

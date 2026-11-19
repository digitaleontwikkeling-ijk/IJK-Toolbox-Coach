import { sessieCookieHeader } from "@/auth/sessie";
import { config } from "@/lib/config";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", sessieCookieHeader("", { inIframe: config.cookieInIframe, maxAge: 0 }));
  return res;
}

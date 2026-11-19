import { SESSIE_COOKIE } from "@/auth/sessie";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${SESSIE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}

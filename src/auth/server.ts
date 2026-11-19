/** Sessie lezen in server components (pagina's). */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { leesSessie, SESSIE_COOKIE, type Gebruiker } from "./sessie";

export async function huidigeGebruiker(): Promise<Gebruiker | null> {
  return leesSessie((await cookies()).get(SESSIE_COOKIE)?.value);
}

export async function vereisGebruiker(): Promise<Gebruiker> {
  const g = await huidigeGebruiker();
  if (!g) redirect("/login");
  return g;
}

/** Sessie lezen in server components (pagina's). */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { heeftRol, leesSessie, SESSIE_COOKIE, type Gebruiker } from "./sessie";
import type { Rol } from "./rollen";

export async function huidigeGebruiker(): Promise<Gebruiker | null> {
  return leesSessie((await cookies()).get(SESSIE_COOKIE)?.value);
}

export async function vereisGebruiker(): Promise<Gebruiker> {
  const g = await huidigeGebruiker();
  if (!g) redirect("/login");
  return g;
}

/** Ingelogd én één van de rollen; anders `null` (de pagina toont dan "geen toegang"). */
export async function gebruikerMetRol(...rollen: Rol[]): Promise<Gebruiker | null> {
  const g = await vereisGebruiker();
  return heeftRol(g, ...rollen) ? g : null;
}

import { redirect } from "next/navigation";
import { huidigeGebruiker } from "@/auth/server";
import { startPad } from "@/lib/paden";

export default async function Start() {
  const g = await huidigeGebruiker();
  redirect(g ? startPad(g.rollen) : "/login");
}

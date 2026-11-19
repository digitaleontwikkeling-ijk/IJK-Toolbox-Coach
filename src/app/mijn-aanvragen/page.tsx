import { vereisGebruiker } from "@/auth/server";
import { MijnAanvragen } from "@/components/MijnAanvragen";

export const metadata = { title: "Mijn aanvragen · IJK Toolbox Coach" };

export default async function MijnAanvragenPagina() {
  await vereisGebruiker();
  return <MijnAanvragen />;
}

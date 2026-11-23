import { gebruikerMetRol } from "@/auth/server";
import { GeenToegang } from "@/components/GeenToegang";
import { MijnAanvragen } from "@/components/MijnAanvragen";

export const metadata = { title: "Mijn aanvragen · IJK Toolbox Coach" };

export default async function MijnAanvragenPagina() {
  // Alleen medewerkers dienen ideeën in (toetsers niet).
  if (!(await gebruikerMetRol("medewerker"))) return <GeenToegang />;
  return <MijnAanvragen />;
}
